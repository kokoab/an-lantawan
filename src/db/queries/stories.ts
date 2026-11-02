import { and, count, desc, eq, inArray, isNull, notInArray, type SQL, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { media, people, sections, stories, storyAuthors } from '../schema';
import { liveStory } from './live';

/** What a story card or list item needs. */
export interface StorySummary {
  id: number;
  kind: (typeof stories.$inferSelect)['kind'];
  title: string;
  slug: string;
  dek: string | null;
  publishedAt: Date | null;
  section: { name: string; slug: string };
  cover: {
    key: string;
    alt: string | null;
    focalX: number;
    focalY: number;
    width: number | null;
    height: number | null;
  } | null;
}

const summaryColumns = {
  id: stories.id,
  kind: stories.kind,
  title: stories.title,
  slug: stories.slug,
  dek: stories.dek,
  publishedAt: stories.publishedAt,
  sectionName: sections.name,
  sectionSlug: sections.slug,
  coverKey: media.key,
  coverAlt: media.alt,
  focalX: media.focalX,
  focalY: media.focalY,
  coverWidth: media.width,
  coverHeight: media.height,
};

type SummaryRow = {
  [K in keyof typeof summaryColumns]: (typeof summaryColumns)[K]['_']['data'] | null;
};

function toSummary(r: SummaryRow): StorySummary {
  return {
    id: r.id as number,
    kind: r.kind as StorySummary['kind'],
    title: r.title as string,
    slug: r.slug as string,
    dek: r.dek,
    publishedAt: r.publishedAt,
    section: { name: r.sectionName as string, slug: r.sectionSlug as string },
    cover: r.coverKey
      ? {
          key: r.coverKey,
          alt: r.coverAlt,
          focalX: r.focalX ?? 0.5,
          focalY: r.focalY ?? 0.5,
          width: r.coverWidth,
          height: r.coverHeight,
        }
      : null,
  };
}

const published = liveStory;

/** A section and the IDs of its subsections, or null if there is no such live section. */
export async function getSection(db: Db, slug: string) {
  const [section] = await db
    .select()
    .from(sections)
    .where(and(eq(sections.slug, slug), isNull(sections.archivedAt)))
    .limit(1);
  if (!section) return null;
  const children = await db
    .select({ id: sections.id, name: sections.name, slug: sections.slug })
    .from(sections)
    .where(and(eq(sections.parentId, section.id), isNull(sections.archivedAt)))
    .orderBy(sections.sort);
  return { ...section, children };
}

/** Top-level sections in menu order, for filters and links. */
export async function listTopSections(db: Db) {
  return db
    .select({ id: sections.id, name: sections.name, slug: sections.slug })
    .from(sections)
    .where(and(isNull(sections.parentId), isNull(sections.archivedAt)))
    .orderBy(sections.sort);
}

/**
 * Published stories, newest first. Page 1 starts with a lead story followed by a grid;
 * later pages are grid only. `sectionIds` empty means every section; `kind` narrows to one kind.
 */
export async function listStories(
  db: Db,
  {
    sectionIds,
    kind,
    page,
    perPage,
  }: { sectionIds: number[]; kind?: StorySummary['kind']; page: number; perPage: number },
) {
  const where = and(
    published,
    sectionIds.length ? inArray(stories.sectionId, sectionIds) : undefined,
    kind ? eq(stories.kind, kind) : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(stories).where(where);
  const leadCount = 1;
  const offset = page === 1 ? 0 : leadCount + (page - 1) * perPage;
  const limit = page === 1 ? leadCount + perPage : perPage;

  const rows = await db
    .select(summaryColumns)
    .from(stories)
    .innerJoin(sections, eq(sections.id, stories.sectionId))
    .leftJoin(media, eq(media.id, stories.coverId))
    .where(where)
    .orderBy(desc(stories.publishedAt), desc(stories.id))
    .limit(limit)
    .offset(offset);

  const items = rows.map(toSummary);
  const pages = Math.max(1, Math.ceil(Math.max(0, total - leadCount) / perPage));
  return {
    lead: page === 1 ? (items[0] ?? null) : null,
    grid: page === 1 ? items.slice(1) : items,
    total,
    pages,
  };
}

/** The newest published stories from every section. */
export async function listLatest(db: Db, limit: number) {
  const rows = await db
    .select(summaryColumns)
    .from(stories)
    .innerJoin(sections, eq(sections.id, stories.sectionId))
    .leftJoin(media, eq(media.id, stories.coverId))
    .where(published)
    .orderBy(desc(stories.publishedAt), desc(stories.id))
    .limit(limit);
  return rows.map(toSummary);
}

/** Newest published stories matching `where`, skipping the IDs already shown on the page. */
export async function listNewest(
  db: Db,
  { where, exclude = [], limit }: { where?: SQL; exclude?: number[]; limit: number },
) {
  const rows = await db
    .select(summaryColumns)
    .from(stories)
    .innerJoin(sections, eq(sections.id, stories.sectionId))
    .leftJoin(media, eq(media.id, stories.coverId))
    .where(and(published, where, exclude.length ? notInArray(stories.id, exclude) : undefined))
    .orderBy(desc(stories.publishedAt), desc(stories.id))
    .limit(limit);
  return rows.map(toSummary);
}

/** A published story by ID, as a summary. */
export async function getSummary(db: Db, id: number) {
  const [row] = await listNewest(db, { where: eq(stories.id, id), limit: 1 });
  return row ?? null;
}

/** Writer names for each story, in byline order. */
export async function listWriters(db: Db, storyIds: number[]) {
  const out = new Map<number, string[]>();
  if (!storyIds.length) return out;
  const rows = await db
    .select({ storyId: storyAuthors.storyId, name: people.name })
    .from(storyAuthors)
    .innerJoin(people, eq(people.id, storyAuthors.personId))
    .where(and(inArray(storyAuthors.storyId, storyIds), eq(storyAuthors.role, 'writer')))
    .orderBy(storyAuthors.sort);
  for (const r of rows) out.set(r.storyId, [...(out.get(r.storyId) ?? []), r.name]);
  return out;
}

/** A story's body, for reading time and the article page. */
export async function getBody(db: Db, id: number) {
  const [row] = await db
    .select({ body: stories.body })
    .from(stories)
    .where(eq(stories.id, id))
    .limit(1);
  return row?.body ?? null;
}

/** Published stories matching a full-text query, best matches first. */
export async function searchStories(
  db: Db,
  {
    fts,
    sectionIds,
    page,
    perPage,
  }: { fts: string; sectionIds: number[]; page: number; perPage: number },
) {
  const inSection = sectionIds.length ? inArray(stories.sectionId, sectionIds) : undefined;
  const match = sql`${stories.id} IN (SELECT rowid FROM stories_fts WHERE stories_fts MATCH ${fts})`;
  const where = and(published, match, inSection);
  const [{ total }] = await db.select({ total: count() }).from(stories).where(where);
  const rows = await db
    .select(summaryColumns)
    .from(stories)
    .innerJoin(sections, eq(sections.id, stories.sectionId))
    .leftJoin(media, eq(media.id, stories.coverId))
    .where(where)
    .orderBy(
      sql`(SELECT rank FROM stories_fts WHERE stories_fts.rowid = ${stories.id} AND stories_fts MATCH ${fts})`,
      desc(stories.publishedAt),
    )
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { stories: rows.map(toSummary), total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Stories a person is credited on, newest first, and the sections they appear in. */
export async function listStoriesBy(
  db: Db,
  personId: number,
  { page, perPage }: { page: number; perPage: number },
) {
  const credited = sql`${stories.id} IN (SELECT ${storyAuthors.storyId} FROM ${storyAuthors} WHERE ${storyAuthors.personId} = ${personId})`;
  const where = and(published, credited);
  const [{ total }] = await db.select({ total: count() }).from(stories).where(where);
  const [rows, sectionRows, first] = await Promise.all([
    db
      .select(summaryColumns)
      .from(stories)
      .innerJoin(sections, eq(sections.id, stories.sectionId))
      .leftJoin(media, eq(media.id, stories.coverId))
      .where(where)
      .orderBy(desc(stories.publishedAt), desc(stories.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .selectDistinct({ name: sections.name })
      .from(stories)
      .innerJoin(sections, eq(sections.id, stories.sectionId))
      .where(where),
    db
      .select({ at: stories.publishedAt })
      .from(stories)
      .where(where)
      .orderBy(stories.publishedAt)
      .limit(1),
  ]);
  return {
    stories: rows.map(toSummary),
    total,
    pages: Math.max(1, Math.ceil(total / perPage)),
    sections: sectionRows.map((s) => s.name),
    firstAt: first[0]?.at ?? null,
  };
}
