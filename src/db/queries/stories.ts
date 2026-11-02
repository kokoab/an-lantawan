import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../client';
import { media, sections, stories } from '../schema';

/** What a story card or list item needs. */
export interface StorySummary {
  id: number;
  kind: (typeof stories.$inferSelect)['kind'];
  title: string;
  slug: string;
  dek: string | null;
  publishedAt: Date | null;
  section: { name: string; slug: string };
  cover: { key: string; alt: string | null; focalX: number; focalY: number } | null;
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
      ? { key: r.coverKey, alt: r.coverAlt, focalX: r.focalX ?? 0.5, focalY: r.focalY ?? 0.5 }
      : null,
  };
}

const published = eq(stories.status, 'published');

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
 * later pages are grid only. `sectionIds` empty means every section.
 */
export async function listStories(
  db: Db,
  { sectionIds, page, perPage }: { sectionIds: number[]; page: number; perPage: number },
) {
  const where = sectionIds.length
    ? and(published, inArray(stories.sectionId, sectionIds))
    : published;

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
