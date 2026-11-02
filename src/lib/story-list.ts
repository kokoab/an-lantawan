import { STORIES_PER_PAGE } from '../core/paging';
import type { Db } from '../db/client';
import { listStories, listTopSections } from '../db/queries/stories';

/** Data for a story list page. `current` is the section slug, or null for All stories. */
export async function loadStoryList(
  db: Db,
  { current, sectionIds, page }: { current: string | null; sectionIds: number[]; page: number },
) {
  const [result, sections] = await Promise.all([
    listStories(db, { sectionIds, page, perPage: STORIES_PER_PAGE }),
    listTopSections(db),
  ]);
  const filters = [
    { label: 'All stories', href: '/stories', current: current === null },
    ...sections.map((s) => ({ label: s.name, href: `/${s.slug}`, current: s.slug === current })),
  ];
  return { ...result, filters };
}
