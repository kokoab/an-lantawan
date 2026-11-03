import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../client';
import {
  categories,
  events,
  matches,
  media,
  people,
  sportsfests,
  stages,
  stories,
  storyAuthors,
  sumatMessages,
} from '../../schema';
import { getSettings } from '../settings';
import { getSummary, listNewest } from '../stories';

/** Drafts and scheduled stories, newest edits first, with who last worked on them. */
export async function listWaiting(db: Db, limit = 5) {
  const where = inArray(stories.status, ['draft', 'scheduled']);
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(stories).where(where),
    db
      .select({
        id: stories.id,
        title: stories.title,
        status: stories.status,
        publishedAt: stories.publishedAt,
        updatedAt: stories.updatedAt,
        coverKey: media.key,
        editor: people.name,
      })
      .from(stories)
      .leftJoin(media, eq(media.id, stories.coverId))
      .leftJoin(people, eq(people.id, stories.updatedByPersonId))
      .where(where)
      .orderBy(desc(stories.updatedAt))
      .limit(limit),
  ]);
  const ids = rows.filter((r) => !r.editor).map((r) => r.id);
  const writers = ids.length
    ? await db
        .select({ storyId: storyAuthors.storyId, name: people.name })
        .from(storyAuthors)
        .innerJoin(people, eq(people.id, storyAuthors.personId))
        .where(and(inArray(storyAuthors.storyId, ids), eq(storyAuthors.role, 'writer')))
    : [];
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      editor: r.editor ?? writers.find((w) => w.storyId === r.id)?.name ?? null,
    })),
  };
}

/** The story at the top of the homepage: the pinned one, or else the newest. */
export async function getTopStory(db: Db) {
  const s = await getSettings(db, {
    'home.pinned_story_id': null as number | null,
    'home.sportsfest_banner': true,
  });
  const pinned = s['home.pinned_story_id'] ? await getSummary(db, s['home.pinned_story_id']) : null;
  const story = pinned ?? (await listNewest(db, { limit: 1 }))[0] ?? null;
  return { story, pinned: pinned !== null, banner: s['home.sportsfest_banner'] };
}

/** The newest Sumat messages nobody has sorted yet. */
export async function listNewLetters(db: Db, limit = 3) {
  const where = eq(sumatMessages.status, 'new');
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(sumatMessages).where(where),
    db
      .select()
      .from(sumatMessages)
      .where(where)
      .orderBy(desc(sumatMessages.receivedAt))
      .limit(limit),
  ]);
  return { total, rows };
}

/** Categories of ongoing events in an ongoing Sportsfest, with the stage being played. */
export async function listOngoing(db: Db) {
  const [sf] = await db
    .select()
    .from(sportsfests)
    .where(eq(sportsfests.status, 'ongoing'))
    .orderBy(desc(sportsfests.year))
    .limit(1);
  if (!sf) return null;
  const cats = await db
    .select({ id: categories.id, name: categories.name, event: events.name, eventId: events.id })
    .from(categories)
    .innerJoin(events, eq(events.id, categories.eventId))
    .where(and(eq(events.sportsfestId, sf.id), eq(events.status, 'ongoing')))
    .orderBy(events.name, categories.sort);
  const live = cats.length
    ? await db
        .select({ categoryId: stages.categoryId, stage: stages.name, round: matches.round })
        .from(matches)
        .innerJoin(stages, eq(stages.id, matches.stageId))
        .where(
          and(
            inArray(
              stages.categoryId,
              cats.map((c) => c.id),
            ),
            eq(matches.status, 'ongoing'),
          ),
        )
    : [];
  return {
    sportsfest: sf,
    rows: cats.map((c) => ({ ...c, live: live.find((l) => l.categoryId === c.id)?.stage ?? null })),
  };
}
