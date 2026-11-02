import { and, asc, count, desc, eq, inArray, like, sql } from 'drizzle-orm';
import type { Doc } from '../../../core/content/doc';
import { slugify } from '../../../core/slug';
import { type Query, runBatch } from '../../batch';
import type { Db } from '../../client';
import {
  events,
  media,
  people,
  redirects,
  sections,
  sportsfests,
  stories,
  storyAuthors,
  storyEvents,
  storyMedia,
  storyTags,
  storyVersions,
  tags,
} from '../../schema';

type StoryRow = typeof stories.$inferSelect;
export type StoryStatus = StoryRow['status'];
export type StoryKind = StoryRow['kind'];
export type CreditRole = (typeof storyAuthors.$inferSelect)['role'];

/** Stories for the admin list, newest edits first. */
export async function listAdminStories(
  db: Db,
  f: {
    status: StoryStatus | null;
    sectionId: number | null;
    kind: StoryKind | null;
    q: string;
    page: number;
    perPage: number;
  },
) {
  const words = f.q.split(/\s+/).filter(Boolean).slice(0, 6);
  const where = and(
    f.status ? eq(stories.status, f.status) : undefined,
    f.sectionId ? eq(stories.sectionId, f.sectionId) : undefined,
    f.kind ? eq(stories.kind, f.kind) : undefined,
    ...words.map((w) => like(stories.title, `%${w}%`)),
  );
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(stories).where(where),
    db
      .select({
        id: stories.id,
        title: stories.title,
        status: stories.status,
        kind: stories.kind,
        publishedAt: stories.publishedAt,
        updatedAt: stories.updatedAt,
        section: sections.name,
        coverKey: media.key,
      })
      .from(stories)
      .innerJoin(sections, eq(sections.id, stories.sectionId))
      .leftJoin(media, eq(media.id, stories.coverId))
      .where(where)
      .orderBy(desc(stories.updatedAt), desc(stories.id))
      .limit(f.perPage)
      .offset((f.page - 1) * f.perPage),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / f.perPage)) };
}

/** A story with everything its edit form shows. */
export async function getStoryForEdit(db: Db, id: number) {
  const [story] = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  if (!story) return null;
  const [credits, tagRows, eventRows, cover, section] = await Promise.all([
    db
      .select({ personId: storyAuthors.personId, role: storyAuthors.role, name: people.name })
      .from(storyAuthors)
      .innerJoin(people, eq(people.id, storyAuthors.personId))
      .where(eq(storyAuthors.storyId, id))
      .orderBy(asc(storyAuthors.sort)),
    db
      .select({ name: tags.name })
      .from(storyTags)
      .innerJoin(tags, eq(tags.id, storyTags.tagId))
      .where(eq(storyTags.storyId, id)),
    db
      .select({ eventId: storyEvents.eventId })
      .from(storyEvents)
      .where(eq(storyEvents.storyId, id)),
    story.coverId
      ? db
          .select({ id: media.id, key: media.key, alt: media.alt })
          .from(media)
          .where(eq(media.id, story.coverId))
      : [],
    db.select({ slug: sections.slug }).from(sections).where(eq(sections.id, story.sectionId)),
  ]);
  return {
    ...story,
    body: story.body as Doc,
    sectionSlug: section[0]?.slug ?? '',
    credits,
    tags: tagRows.map((t) => t.name),
    eventIds: eventRows.map((e) => e.eventId),
    cover: cover[0] ? { ...cover[0], alt: cover[0].alt ?? '' } : null,
  };
}

export async function storySlugTaken(db: Db, slug: string, exceptId: number | null) {
  const [row] = await db.select({ id: stories.id }).from(stories).where(eq(stories.slug, slug));
  return row !== undefined && row.id !== exceptId;
}

/** Sportsfest events stories can be linked to, newest Sportsfest first. */
export async function listEventChoices(db: Db) {
  return db
    .select({ id: events.id, name: events.name, year: sportsfests.year })
    .from(events)
    .innerJoin(sportsfests, eq(sportsfests.id, events.sportsfestId))
    .orderBy(desc(sportsfests.year), asc(events.name));
}

/** Which of these media IDs really exist, so a story can't point at a missing file. */
export async function existingMediaIds(db: Db, ids: number[]) {
  if (!ids.length) return [];
  const rows = await db.select({ id: media.id }).from(media).where(inArray(media.id, ids));
  return rows.map((r) => r.id);
}

export interface StoryInput {
  sectionId: number;
  kind: StoryKind;
  status: StoryStatus;
  title: string;
  slug: string;
  dek: string | null;
  body: Doc;
  coverId: number | null;
  cartoonOnTop: boolean;
  writerPhoto: boolean;
  videoUrl: string | null;
  publishedAt: Date | null;
  credits: Array<{ personId: number; role: CreditRole }>;
  tags: string[];
  eventIds: number[];
  mediaIds: number[];
}

const tagSlug = (name: string) => slugify(name).slice(0, 60);

/**
 * Saves a story and everything hanging off it in one batch: credits, tags, the files it
 * uses, Sportsfest links and a version snapshot. When a live story's address changes, the
 * old address is kept as a redirect.
 */
export async function saveStory(
  db: Db,
  existing: { id: number; slug: string; sectionSlug: string; wasLive: boolean } | null,
  input: StoryInput,
  editorId: number,
  newSectionSlug: string,
) {
  // Tags are created first so their IDs are known.
  const tagNames = [...new Map(input.tags.map((t) => [tagSlug(t), t])).entries()].filter(
    ([s]) => s,
  );
  if (tagNames.length) {
    await db
      .insert(tags)
      .values(tagNames.map(([slug, name]) => ({ slug, name })))
      .onConflictDoNothing();
  }
  const tagIds = tagNames.length
    ? (
        await db
          .select({ id: tags.id })
          .from(tags)
          .where(
            inArray(
              tags.slug,
              tagNames.map(([s]) => s),
            ),
          )
      ).map((t) => t.id)
    : [];

  const row = {
    sectionId: input.sectionId,
    kind: input.kind,
    status: input.status,
    title: input.title,
    slug: input.slug,
    dek: input.dek,
    body: input.body,
    coverId: input.coverId,
    cartoonOnTop: input.cartoonOnTop,
    writerPhoto: input.writerPhoto,
    videoUrl: input.videoUrl,
    publishedAt: input.publishedAt,
    updatedAt: sql`(unixepoch())`,
  };
  let id: number;
  const queries: Query[] = [];
  if (existing) {
    id = existing.id;
    queries.push(db.update(stories).set(row).where(eq(stories.id, id)));
  } else {
    const [created] = await db.insert(stories).values(row).returning({ id: stories.id });
    id = created.id;
  }

  const files = [...new Set([...input.mediaIds, ...(input.coverId ? [input.coverId] : [])])];
  queries.push(
    db.delete(storyAuthors).where(eq(storyAuthors.storyId, id)),
    db.delete(storyTags).where(eq(storyTags.storyId, id)),
    db.delete(storyMedia).where(eq(storyMedia.storyId, id)),
    db.delete(storyEvents).where(eq(storyEvents.storyId, id)),
    ...input.credits.map((c, sort) =>
      db
        .insert(storyAuthors)
        .values({ storyId: id, ...c, sort })
        .onConflictDoNothing(),
    ),
    ...tagIds.map((tagId) => db.insert(storyTags).values({ storyId: id, tagId })),
    ...files.map((mediaId) => db.insert(storyMedia).values({ storyId: id, mediaId })),
    ...input.eventIds.map((eventId) => db.insert(storyEvents).values({ storyId: id, eventId })),
    db.insert(storyVersions).values({
      storyId: id,
      title: input.title,
      dek: input.dek,
      body: input.body,
      savedBy: editorId,
    }),
  );

  const oldPath = existing ? `/${existing.sectionSlug}/${existing.slug}` : null;
  const newPath = `/${newSectionSlug}/${input.slug}`;
  if (existing?.wasLive && oldPath && existing.slug !== input.slug) {
    queries.push(
      db.delete(redirects).where(eq(redirects.fromPath, newPath)),
      db
        .insert(redirects)
        .values({ fromPath: oldPath, toPath: newPath })
        .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: newPath } }),
      db.update(redirects).set({ toPath: newPath }).where(eq(redirects.toPath, oldPath)),
    );
  }
  await runBatch(db, queries);
  return id;
}

export async function setStoryState(
  db: Db,
  id: number,
  status: StoryStatus,
  publishedAt: Date | null,
) {
  await db
    .update(stories)
    .set({ status, publishedAt, updatedAt: sql`(unixepoch())` })
    .where(eq(stories.id, id));
}

/** The last saves of a story, newest first. */
export async function listVersions(db: Db, storyId: number, limit = 15) {
  return db
    .select({
      id: storyVersions.id,
      title: storyVersions.title,
      savedAt: storyVersions.savedAt,
      savedBy: storyVersions.savedBy,
    })
    .from(storyVersions)
    .where(eq(storyVersions.storyId, storyId))
    .orderBy(desc(storyVersions.savedAt), desc(storyVersions.id))
    .limit(limit);
}

export async function getVersion(db: Db, storyId: number, versionId: number) {
  const [row] = await db
    .select()
    .from(storyVersions)
    .where(and(eq(storyVersions.id, versionId), eq(storyVersions.storyId, storyId)))
    .limit(1);
  return row ?? null;
}

/** Puts an older version's headline, summary and text back, keeping a snapshot of it. */
export async function restoreVersion(
  db: Db,
  storyId: number,
  version: typeof storyVersions.$inferSelect,
  editorId: number,
) {
  await runBatch(db, [
    db
      .update(stories)
      .set({
        title: version.title,
        dek: version.dek,
        body: version.body,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(stories.id, storyId)),
    db.insert(storyVersions).values({
      storyId,
      title: version.title,
      dek: version.dek,
      body: version.body,
      savedBy: editorId,
    }),
  ]);
}
