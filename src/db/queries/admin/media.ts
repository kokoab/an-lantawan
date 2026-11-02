import { and, count, desc, eq, inArray, like, or, type SQL } from 'drizzle-orm';
import type { Db } from '../../client';
import { issues, media, people, stories, storyMedia, tribus } from '../../schema';

export type MediaRow = typeof media.$inferSelect;

/** The library, newest first, filtered by kind and by words in the alt text or caption. */
export async function listMedia(
  db: Db,
  {
    kind,
    q,
    page,
    perPage,
  }: { kind: 'image' | 'pdf' | null; q: string; page: number; perPage: number },
) {
  const words = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const where = and(
    kind ? eq(media.kind, kind) : undefined,
    ...words.map(
      (w) =>
        or(
          like(media.alt, `%${w}%`),
          like(media.caption, `%${w}%`),
          like(media.key, `%${w}%`),
        ) as SQL,
    ),
  );
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(media).where(where),
    db
      .select()
      .from(media)
      .where(where)
      .orderBy(desc(media.createdAt), desc(media.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getMedia(db: Db, id: number) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ?? null;
}

export async function insertMedia(db: Db, row: typeof media.$inferInsert) {
  const [created] = await db.insert(media).values(row).returning();
  return created;
}

export async function updateMedia(
  db: Db,
  id: number,
  input: Pick<MediaRow, 'alt' | 'caption' | 'creditPersonId' | 'creditText' | 'focalX' | 'focalY'>,
) {
  await db.update(media).set(input).where(eq(media.id, id));
}

/** Everything that uses a file. A file that is used anywhere can't be deleted. */
export async function mediaUsage(db: Db, id: number) {
  const [inStories, covers, issueRows, portraits, logos] = await Promise.all([
    db
      .select({ id: stories.id, title: stories.title })
      .from(storyMedia)
      .innerJoin(stories, eq(stories.id, storyMedia.storyId))
      .where(eq(storyMedia.mediaId, id)),
    db
      .select({ id: stories.id, title: stories.title })
      .from(stories)
      .where(eq(stories.coverId, id)),
    db
      .select({ id: issues.id, title: issues.title })
      .from(issues)
      .where(or(eq(issues.pdfId, id), eq(issues.coverId, id))),
    db.select({ id: people.id, name: people.name }).from(people).where(eq(people.photoId, id)),
    db.select({ id: tribus.id, name: tribus.name }).from(tribus).where(eq(tribus.logoId, id)),
  ]);
  const storyMap = new Map([...inStories, ...covers].map((s) => [s.id, s]));
  return { stories: [...storyMap.values()], issues: issueRows, people: portraits, tribus: logos };
}

export async function deleteMedia(db: Db, id: number) {
  await db.delete(media).where(eq(media.id, id));
}

/** Files by ID, for showing chosen photos in forms. */
export async function getMediaByIds(db: Db, ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(media).where(inArray(media.id, ids));
}
