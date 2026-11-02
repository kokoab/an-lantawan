import { and, asc, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { type Medal, medalTally } from '../../core/sportsfest/tally';
import type { Db } from '../client';
import {
  categories,
  events,
  matches,
  matchSets,
  media,
  placements,
  sportsfests,
  sportsfestTribus,
  stageEntries,
  stages,
  stories,
  storyEvents,
  tribus,
} from '../schema';
import { listNewest } from './stories';

export interface TribuInfo {
  id: number;
  name: string;
  slug: string;
  color: string;
  logoKey: string | null;
}

const tribuColumns = {
  id: tribus.id,
  name: tribus.name,
  slug: tribus.slug,
  color: tribus.color,
  logoKey: media.key,
};

/** The Sportsfest of a year, or the newest one, with the tribus taking part. */
export async function getSportsfest(db: Db, year?: number) {
  const [sf] = await db
    .select()
    .from(sportsfests)
    .where(year ? eq(sportsfests.year, year) : undefined)
    .orderBy(desc(sportsfests.year))
    .limit(1);
  if (!sf) return null;
  const teams: TribuInfo[] = await db
    .select(tribuColumns)
    .from(sportsfestTribus)
    .innerJoin(tribus, eq(tribus.id, sportsfestTribus.tribuId))
    .leftJoin(media, eq(media.id, tribus.logoId))
    .where(eq(sportsfestTribus.sportsfestId, sf.id))
    .orderBy(tribus.sort, tribus.name);
  return { ...sf, tribus: teams };
}

export type Sportsfest = NonNullable<Awaited<ReturnType<typeof getSportsfest>>>;

export async function listSportsfests(db: Db) {
  return db.select().from(sportsfests).orderBy(desc(sportsfests.year));
}

/** Every medal of a Sportsfest, with the category and event it came from. */
async function listPlacements(db: Db, sportsfestId: number) {
  return db
    .select({
      tribuId: placements.tribuId,
      place: placements.place,
      mark: placements.mark,
      categoryId: categories.id,
    })
    .from(placements)
    .innerJoin(categories, eq(categories.id, placements.categoryId))
    .innerJoin(events, eq(events.id, categories.eventId))
    .where(and(eq(events.sportsfestId, sportsfestId), ne(events.status, 'cancelled')));
}

/** The medal tally of a Sportsfest, computed from results and never stored. */
export async function getTally(db: Db, sf: Sportsfest) {
  const medals = await listPlacements(db, sf.id);
  const rows = medalTally(
    sf.tribus.map((t) => t.id),
    medals.map((m) => ({ tribuId: m.tribuId, place: m.place as Medal })),
  );
  const byId = new Map(sf.tribus.map((t) => [t.id, t]));
  return rows.flatMap((r) => {
    const tribu = byId.get(r.tribuId);
    return tribu ? [{ ...r, tribu }] : [];
  });
}

export type Tally = Awaited<ReturnType<typeof getTally>>;

type EventRecord = typeof events.$inferSelect;

/** One medal event: a category of an event, such as basketball, women's. */
export interface EventRow {
  event: Pick<
    EventRecord,
    'id' | 'name' | 'slug' | 'type' | 'status' | 'startsAt' | 'venue' | 'note'
  >;
  categoryId: number;
  category: string;
  /** Tribu IDs by place. Ties put two tribus on one place. */
  medals: Record<Medal, number[]>;
}

/** Every medal event of a Sportsfest, in event name and category order. */
export async function listEventRows(db: Db, sportsfestId: number): Promise<EventRow[]> {
  const [rows, medals] = await Promise.all([
    db
      .select({
        event: {
          id: events.id,
          name: events.name,
          slug: events.slug,
          type: events.type,
          status: events.status,
          startsAt: events.startsAt,
          venue: events.venue,
          note: events.note,
        },
        categoryId: categories.id,
        category: categories.name,
      })
      .from(categories)
      .innerJoin(events, eq(events.id, categories.eventId))
      .where(eq(events.sportsfestId, sportsfestId))
      .orderBy(asc(events.name), asc(categories.sort), asc(categories.name)),
    listPlacements(db, sportsfestId),
  ]);
  return rows.map((r) => {
    const here = medals.filter((m) => m.categoryId === r.categoryId);
    const at = (p: Medal) => here.filter((m) => m.place === p).map((m) => m.tribuId);
    return { ...r, medals: { 1: at(1), 2: at(2), 3: at(3) } };
  });
}

/** An event with its categories, and the brackets, groups and results of one category. */
export async function getEvent(db: Db, sportsfestId: number, slug: string, categoryId?: number) {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.sportsfestId, sportsfestId), eq(events.slug, slug)))
    .limit(1);
  if (!event) return null;
  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.eventId, event.id))
    .orderBy(categories.sort, categories.name);
  const category = cats.find((c) => c.id === categoryId) ?? cats[0] ?? null;
  if (!category) return { event, categories: cats, category, results: [], stages: [] };

  const [results, stageRows] = await Promise.all([
    db
      .select({ tribuId: placements.tribuId, place: placements.place, mark: placements.mark })
      .from(placements)
      .where(eq(placements.categoryId, category.id))
      .orderBy(placements.place),
    db.select().from(stages).where(eq(stages.categoryId, category.id)).orderBy(stages.sort),
  ]);
  const stageIds = stageRows.map((s) => s.id);
  const [matchRows, entries] = stageIds.length
    ? await Promise.all([
        db
          .select()
          .from(matches)
          .where(inArray(matches.stageId, stageIds))
          .orderBy(matches.round, matches.position),
        db.select().from(stageEntries).where(inArray(stageEntries.stageId, stageIds)),
      ])
    : [[], []];
  const sets = matchRows.length
    ? await db
        .select()
        .from(matchSets)
        .where(
          inArray(
            matchSets.matchId,
            matchRows.map((m) => m.id),
          ),
        )
        .orderBy(matchSets.n)
    : [];
  return {
    event,
    categories: cats,
    category,
    results,
    stages: stageRows.map((s) => ({
      ...s,
      tribuIds: entries.filter((e) => e.stageId === s.id).map((e) => e.tribuId),
      matches: matchRows
        .filter((m) => m.stageId === s.id)
        .map((m) => ({ ...m, sets: sets.filter((x) => x.matchId === m.id) })),
    })),
  };
}

export type EventPage = NonNullable<Awaited<ReturnType<typeof getEvent>>>;
export type StageView = EventPage['stages'][number];
export type MatchView = StageView['matches'][number];

/** Published stories linked to a Sportsfest's events, or to one event, newest first. */
export async function listCoverage(
  db: Db,
  sportsfestId: number,
  { eventId, limit = 3 }: { eventId?: number; limit?: number } = {},
) {
  const linked = db
    .select({ id: storyEvents.storyId })
    .from(storyEvents)
    .innerJoin(events, eq(events.id, storyEvents.eventId))
    .where(
      and(eq(events.sportsfestId, sportsfestId), eventId ? eq(events.id, eventId) : undefined),
    );
  return listNewest(db, { where: inArray(stories.id, linked), limit });
}

export async function getTribu(db: Db, slug: string) {
  const [t] = await db
    .select(tribuColumns)
    .from(tribus)
    .leftJoin(media, eq(media.id, tribus.logoId))
    .where(and(eq(tribus.slug, slug), isNull(tribus.archivedAt)))
    .limit(1);
  return (t as TribuInfo | undefined) ?? null;
}

/** A tribu's matches that are still to be played or under way, soonest first. */
export async function listNextMatches(db: Db, sportsfestId: number, tribuId: number, limit = 3) {
  return db
    .select({
      id: matches.id,
      status: matches.status,
      startsAt: matches.startsAt,
      venue: matches.venue,
      homeTribuId: matches.homeTribuId,
      awayTribuId: matches.awayTribuId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      stage: stages.name,
      category: categories.name,
      event: events.name,
      eventSlug: events.slug,
      eventVenue: events.venue,
    })
    .from(matches)
    .innerJoin(stages, eq(stages.id, matches.stageId))
    .innerJoin(categories, eq(categories.id, stages.categoryId))
    .innerJoin(events, eq(events.id, categories.eventId))
    .where(
      and(
        eq(events.sportsfestId, sportsfestId),
        or(eq(matches.homeTribuId, tribuId), eq(matches.awayTribuId, tribuId)),
        inArray(matches.status, ['scheduled', 'ongoing']),
      ),
    )
    .orderBy(desc(eq(matches.status, 'ongoing')), asc(matches.startsAt))
    .limit(limit);
}
