import { eq, inArray } from 'drizzle-orm';
import type { Doc } from '../../core/content/doc';
import { readingMinutes } from '../../core/content/reading';
import type { Db } from '../client';
import { stories } from '../schema';
import { getSettings } from './settings';
import { getBody, getSection, getSummary, listNewest, listWriters } from './stories';

async function sectionIds(db: Db, slug: string) {
  const s = await getSection(db, slug);
  return s ? [s.id, ...s.children.map((c) => c.id)] : [];
}

/**
 * Everything the homepage shows. The lead is the pinned story, or the newest one if
 * nothing is pinned; every later block skips stories already shown above it.
 */
export async function getHomepage(db: Db) {
  const { 'home.pinned_story_id': pinnedId } = await getSettings(db, {
    'home.pinned_story_id': null as number | null,
  });
  const pinned = pinnedId ? await getSummary(db, pinnedId) : null;
  const newest = await listNewest(db, { limit: 6, exclude: pinned ? [pinned.id] : [] });
  const lead = pinned ?? newest[0] ?? null;
  const latest = newest.filter((s) => s.id !== lead?.id).slice(0, 5);
  const shown = [lead, ...latest].filter(Boolean).map((s) => (s as { id: number }).id);

  const [newsIds, opinionIds] = await Promise.all([
    sectionIds(db, 'news'),
    sectionIds(db, 'opinion'),
  ]);
  const [news, opinion, letters, leadBody] = await Promise.all([
    newsIds.length
      ? listNewest(db, { where: inArray(stories.sectionId, newsIds), exclude: shown, limit: 2 })
      : [],
    opinionIds.length
      ? listNewest(db, { where: inArray(stories.sectionId, opinionIds), exclude: shown, limit: 4 })
      : [],
    listNewest(db, { where: eq(stories.kind, 'letter'), limit: 2 }),
    lead ? getBody(db, lead.id) : null,
  ]);
  const writers = await listWriters(
    db,
    opinion.map((s) => s.id),
  );

  return {
    lead,
    leadMinutes: leadBody ? readingMinutes(leadBody as Doc) : null,
    latest,
    news,
    opinion: opinion.map((s) => ({ ...s, writers: writers.get(s.id) ?? [] })),
    letters,
  };
}
