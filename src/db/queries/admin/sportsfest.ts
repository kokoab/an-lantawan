import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { BracketMatch, BracketStage } from '../../../core/sportsfest/bracket';
import type { Finish } from '../../../core/sportsfest/medals';
import { type Query, runBatch } from '../../batch';
import type { Db } from '../../client';
import {
  categories,
  events,
  matches,
  media,
  placements,
  sportsfests,
  sportsfestTribus,
  stageEntries,
  stages,
  tribus,
} from '../../schema';

/* Tribus */

export async function listAllTribus(db: Db) {
  return db
    .select({
      id: tribus.id,
      name: tribus.name,
      slug: tribus.slug,
      color: tribus.color,
      sort: tribus.sort,
      archivedAt: tribus.archivedAt,
      logoId: tribus.logoId,
      logoKey: media.key,
    })
    .from(tribus)
    .leftJoin(media, eq(media.id, tribus.logoId))
    .orderBy(asc(tribus.sort), asc(tribus.name));
}

export async function tribuSlugTaken(db: Db, slug: string, exceptId: number | null) {
  const [row] = await db.select({ id: tribus.id }).from(tribus).where(eq(tribus.slug, slug));
  return row !== undefined && row.id !== exceptId;
}

type TribuInput = Pick<typeof tribus.$inferInsert, 'name' | 'slug' | 'color' | 'sort' | 'logoId'>;

export async function createTribu(db: Db, input: TribuInput) {
  const [row] = await db.insert(tribus).values(input).returning({ id: tribus.id });
  return row.id;
}

export async function updateTribu(db: Db, id: number, input: TribuInput) {
  await db.update(tribus).set(input).where(eq(tribus.id, id));
}

export async function setTribuArchived(db: Db, id: number, archived: boolean) {
  await db
    .update(tribus)
    .set({ archivedAt: archived ? sql`(unixepoch())` : null })
    .where(eq(tribus.id, id));
}

/* Sportsfests */

export async function listSportsfestsAdmin(db: Db) {
  const [rows, counts] = await Promise.all([
    db.select().from(sportsfests).orderBy(desc(sportsfests.year)),
    db
      .select({ sportsfestId: events.sportsfestId, n: count() })
      .from(events)
      .groupBy(events.sportsfestId),
  ]);
  const byId = new Map(counts.map((c) => [c.sportsfestId, c.n]));
  return rows.map((r) => ({ ...r, events: byId.get(r.id) ?? 0 }));
}

export async function getSportsfestRow(db: Db, year: number) {
  const [row] = await db.select().from(sportsfests).where(eq(sportsfests.year, year)).limit(1);
  if (!row) return null;
  const joined = await db
    .select({ tribuId: sportsfestTribus.tribuId })
    .from(sportsfestTribus)
    .where(eq(sportsfestTribus.sportsfestId, row.id));
  return { ...row, tribuIds: joined.map((j) => j.tribuId) };
}

export async function yearTaken(db: Db, year: number, exceptId: number | null) {
  const [row] = await db
    .select({ id: sportsfests.id })
    .from(sportsfests)
    .where(eq(sportsfests.year, year));
  return row !== undefined && row.id !== exceptId;
}

type SportsfestInput = Pick<
  typeof sportsfests.$inferInsert,
  'year' | 'name' | 'theme' | 'status' | 'startsOn' | 'endsOn'
>;

/** Adds a Sportsfest with every current tribu taking part. */
export async function createSportsfest(db: Db, input: SportsfestInput) {
  const [row] = await db.insert(sportsfests).values(input).returning({ id: sportsfests.id });
  const current = await db.select({ id: tribus.id }).from(tribus).where(isNull(tribus.archivedAt));
  await runBatch(
    db,
    current.map((t) => db.insert(sportsfestTribus).values({ sportsfestId: row.id, tribuId: t.id })),
  );
  return row.id;
}

export async function updateSportsfest(
  db: Db,
  id: number,
  input: SportsfestInput,
  tribuIds: number[],
) {
  await runBatch(db, [
    db.update(sportsfests).set(input).where(eq(sportsfests.id, id)),
    db.delete(sportsfestTribus).where(eq(sportsfestTribus.sportsfestId, id)),
    ...tribuIds.map((tribuId) => db.insert(sportsfestTribus).values({ sportsfestId: id, tribuId })),
  ]);
}

/** Whether a tribu has results in a Sportsfest, so it can't be taken out of it. */
export async function tribusWithResults(db: Db, sportsfestId: number) {
  const rows = await db
    .selectDistinct({ tribuId: placements.tribuId })
    .from(placements)
    .innerJoin(categories, eq(categories.id, placements.categoryId))
    .innerJoin(events, eq(events.id, categories.eventId))
    .where(eq(events.sportsfestId, sportsfestId));
  return rows.map((r) => r.tribuId);
}

/* Events and categories */

export async function listEventsAdmin(db: Db, sportsfestId: number) {
  const [rows, cats] = await Promise.all([
    db.select().from(events).where(eq(events.sportsfestId, sportsfestId)).orderBy(asc(events.name)),
    db
      .select({ eventId: categories.eventId, name: categories.name, id: categories.id })
      .from(categories)
      .innerJoin(events, eq(events.id, categories.eventId))
      .where(eq(events.sportsfestId, sportsfestId))
      .orderBy(asc(categories.sort), asc(categories.name)),
  ]);
  const medalled = cats.length
    ? await db
        .selectDistinct({ categoryId: placements.categoryId })
        .from(placements)
        .where(
          inArray(
            placements.categoryId,
            cats.map((c) => c.id),
          ),
        )
    : [];
  const done = new Set(medalled.map((m) => m.categoryId));
  return rows.map((e) => {
    const mine = cats.filter((c) => c.eventId === e.id);
    return {
      ...e,
      categories: mine.map((c) => c.name),
      finished: mine.filter((c) => done.has(c.id)).length,
    };
  });
}

export async function getEventAdmin(db: Db, sportsfestId: number, eventId: number) {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.sportsfestId, sportsfestId)))
    .limit(1);
  if (!event) return null;
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.eventId, eventId))
    .orderBy(asc(categories.sort), asc(categories.name));
  return { ...event, categories: cats };
}

export async function eventSlugTaken(
  db: Db,
  sportsfestId: number,
  slug: string,
  exceptId: number | null,
) {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.sportsfestId, sportsfestId), eq(events.slug, slug)));
  return row !== undefined && row.id !== exceptId;
}

type EventInput = Pick<
  typeof events.$inferInsert,
  'name' | 'slug' | 'type' | 'status' | 'venue' | 'startsAt' | 'note'
>;

export async function createEvent(
  db: Db,
  sportsfestId: number,
  input: EventInput,
  categoryNames: string[],
) {
  const [row] = await db
    .insert(events)
    .values({ ...input, sportsfestId })
    .returning({ id: events.id });
  await runBatch(
    db,
    categoryNames.map((name, sort) =>
      db.insert(categories).values({ eventId: row.id, name, sort }),
    ),
  );
  return row.id;
}

export async function updateEvent(db: Db, id: number, input: EventInput) {
  await db.update(events).set(input).where(eq(events.id, id));
}

/** Deletes an event. Only offered while it has no results or matches. */
export async function deleteEvent(db: Db, id: number) {
  await db.delete(events).where(eq(events.id, id));
}

export async function eventHasResults(db: Db, eventId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(categories)
    .leftJoin(placements, eq(placements.categoryId, categories.id))
    .leftJoin(stages, eq(stages.categoryId, categories.id))
    .where(
      and(
        eq(categories.eventId, eventId),
        sql`(${placements.id} is not null or ${stages.id} is not null)`,
      ),
    );
  return (row?.n ?? 0) > 0;
}

export async function addCategory(db: Db, eventId: number, name: string, sort: number) {
  await db.insert(categories).values({ eventId, name, sort });
}

export async function renameCategory(
  db: Db,
  eventId: number,
  id: number,
  name: string,
  sort: number,
) {
  await db
    .update(categories)
    .set({ name, sort })
    .where(and(eq(categories.id, id), eq(categories.eventId, eventId)));
}

/** Removes a category with its results and matches. */
export async function deleteCategory(db: Db, eventId: number, id: number) {
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.eventId, eventId)));
}

/* Results */

export async function listFinishes(db: Db, categoryId: number) {
  return db.select().from(placements).where(eq(placements.categoryId, categoryId));
}

/** Replaces a category's finishing places. */
export async function saveFinishes(
  db: Db,
  categoryId: number,
  finishes: Array<Finish & { mark?: string | null }>,
) {
  await runBatch(db, [
    db.delete(placements).where(eq(placements.categoryId, categoryId)),
    ...finishes.map((f) =>
      db
        .insert(placements)
        .values({ categoryId, tribuId: f.tribuId, place: f.place, mark: f.mark ?? null }),
    ),
  ]);
}

/* Brackets and groups */

export async function getCompetition(db: Db, categoryId: number) {
  const stageRows = await db
    .select()
    .from(stages)
    .where(eq(stages.categoryId, categoryId))
    .orderBy(asc(stages.sort));
  const ids = stageRows.map((s) => s.id);
  const [matchRows, entries] = ids.length
    ? await Promise.all([
        db
          .select()
          .from(matches)
          .where(inArray(matches.stageId, ids))
          .orderBy(asc(matches.round), asc(matches.position)),
        db.select().from(stageEntries).where(inArray(stageEntries.stageId, ids)),
      ])
    : [[], []];
  return { stages: stageRows, matches: matchRows, entries };
}

export type Competition = Awaited<ReturnType<typeof getCompetition>>;
type MatchRow = Competition['matches'][number];

/**
 * Keys for a category's knockout matches as the core bracket rules know them: the grand
 * final is "GF", a single-elimination third-place match "P3", the rest their database ID.
 */
function matchKeys(c: Competition) {
  const double = c.stages.some((s) => s.kind === 'upper');
  const kinds = new Map(c.stages.map((s) => [s.id, s.kind]));
  const keys = new Map<number, string>();
  for (const m of c.matches) {
    const kind = kinds.get(m.stageId);
    if (!kind || kind === 'group') continue;
    keys.set(m.id, kind === 'final' ? (double ? 'GF' : 'P3') : String(m.id));
  }
  return { keys, double, kinds };
}

/** The core bracket key of one knockout match, or null for round-robin matches. */
export const bracketKey = (c: Competition, matchId: number) =>
  matchKeys(c).keys.get(matchId) ?? null;

/** The knockout matches of a category as the core bracket sees them. */
export function toBracket(c: Competition): BracketMatch[] {
  const { keys, double, kinds } = matchKeys(c);
  return c.matches.flatMap((m): BracketMatch[] => {
    const key = keys.get(m.id);
    if (!key) return [];
    const kind = kinds.get(m.stageId);
    const link = (id: number | null, slot: 'home' | 'away' | null) => {
      const to = id === null ? undefined : keys.get(id);
      return to && slot ? { key: to, slot } : null;
    };
    return [
      {
        key,
        stage: kind === 'final' ? (double ? 'final' : 'single') : (kind as BracketStage),
        round: m.round,
        position: m.position,
        home: m.homeTribuId,
        away: m.awayTribuId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        winner: m.winnerTribuId,
        status: m.status === 'done' ? 'done' : m.status === 'bye' ? 'bye' : 'scheduled',
        winnerTo: link(m.winnerToMatchId, m.winnerToSlot),
        loserTo: link(m.loserToMatchId, m.loserToSlot),
      },
    ];
  });
}

/** Writes back the matches a core result changed, by comparing them with the stored rows. */
export async function applyBracket(db: Db, c: Competition, after: BracketMatch[]) {
  const { keys } = matchKeys(c);
  const rowByKey = new Map<string, MatchRow>();
  for (const m of c.matches) {
    const key = keys.get(m.id);
    if (key) rowByKey.set(key, m);
  }
  const queries: Query[] = [];
  for (const m of after) {
    const row = rowByKey.get(m.key);
    if (!row) continue;
    // Live, postponed and cancelled are kept unless the core rule decided the match.
    const status =
      m.status === 'done' || m.status === 'bye'
        ? m.status
        : row.status === 'done' || row.status === 'bye'
          ? 'scheduled'
          : row.status;
    const changed =
      row.homeTribuId !== m.home ||
      row.awayTribuId !== m.away ||
      row.homeScore !== m.homeScore ||
      row.awayScore !== m.awayScore ||
      row.winnerTribuId !== m.winner ||
      row.status !== status;
    if (!changed) continue;
    queries.push(
      db
        .update(matches)
        .set({
          homeTribuId: m.home,
          awayTribuId: m.away,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          winnerTribuId: m.winner,
          status,
        })
        .where(eq(matches.id, row.id)),
    );
  }
  await runBatch(db, queries);
}

const STAGE_NAMES: Record<BracketStage, string> = {
  single: 'Knockout',
  upper: 'Upper bracket',
  lower: 'Lower bracket',
  final: 'Grand final',
};

/**
 * Saves a generated bracket: its stages, its matches, then the links that send winners and
 * losers on. A single-elimination third-place match gets a stage of its own.
 */
export async function createBracket(db: Db, categoryId: number, bracket: BracketMatch[]) {
  const groupOf = (m: BracketMatch) => (m.key === 'P3' ? 'third' : m.stage);
  const order = ['single', 'upper', 'lower', 'final', 'third'];
  const used = order.filter((g) => bracket.some((m) => groupOf(m) === g));
  const stageIds = new Map<string, number>();
  for (const [sort, g] of used.entries()) {
    const [row] = await db
      .insert(stages)
      .values({
        categoryId,
        kind: g === 'third' ? 'final' : (g as BracketStage),
        name: g === 'third' ? 'Third place' : STAGE_NAMES[g as BracketStage],
        sort,
      })
      .returning({ id: stages.id });
    stageIds.set(g, row.id);
  }
  const idOf = new Map<string, number>();
  for (const g of used) {
    const group = bracket.filter((m) => groupOf(m) === g);
    const rows = await db
      .insert(matches)
      .values(
        group.map((m) => ({
          stageId: stageIds.get(g) as number,
          // The third-place match is the only match of its stage.
          round: g === 'third' ? 1 : m.round,
          position: g === 'third' ? 1 : m.position,
          homeTribuId: m.home,
          awayTribuId: m.away,
          winnerTribuId: m.winner,
          status: m.status,
        })),
      )
      .returning({ id: matches.id });
    for (const [i, m] of group.entries()) idOf.set(m.key, rows[i].id);
  }
  await runBatch(
    db,
    bracket
      .filter((m) => m.winnerTo || m.loserTo)
      .map((m) =>
        db
          .update(matches)
          .set({
            winnerToMatchId: m.winnerTo ? (idOf.get(m.winnerTo.key) ?? null) : null,
            winnerToSlot: m.winnerTo?.slot ?? null,
            loserToMatchId: m.loserTo ? (idOf.get(m.loserTo.key) ?? null) : null,
            loserToSlot: m.loserTo?.slot ?? null,
          })
          .where(eq(matches.id, idOf.get(m.key) as number)),
      ),
  );
}

/** Saves a round robin: one group stage with its tribus and every pairing, round by round. */
export async function createRoundRobin(
  db: Db,
  categoryId: number,
  tribuIds: number[],
  rounds: Array<Array<[number, number | null]>>,
  rule: { win: number; draw: number; loss: number },
) {
  const [stage] = await db
    .insert(stages)
    .values({
      categoryId,
      kind: 'group',
      name: 'Round robin',
      sort: 0,
      pointsWin: rule.win,
      pointsDraw: rule.draw,
      pointsLoss: rule.loss,
    })
    .returning({ id: stages.id });
  await runBatch(db, [
    ...tribuIds.map((tribuId, i) =>
      db.insert(stageEntries).values({ stageId: stage.id, tribuId, seed: i + 1 }),
    ),
    ...rounds.flatMap((pairs, r) =>
      pairs
        .filter((p): p is [number, number] => p[1] !== null)
        .map(([home, away], i) =>
          db.insert(matches).values({
            stageId: stage.id,
            round: r + 1,
            position: i + 1,
            homeTribuId: home,
            awayTribuId: away,
          }),
        ),
    ),
  ]);
}

export async function updateStageRule(
  db: Db,
  stageId: number,
  rule: { win: number; draw: number; loss: number },
) {
  await db
    .update(stages)
    .set({ pointsWin: rule.win, pointsDraw: rule.draw, pointsLoss: rule.loss })
    .where(eq(stages.id, stageId));
}

/** Time, place and status of a match; tribus too, for matches no result has decided. */
export async function updateMatchDetails(
  db: Db,
  id: number,
  d: {
    startsAt: Date | null;
    venue: string | null;
    status?: (typeof matches.$inferSelect)['status'];
  },
) {
  await db.update(matches).set(d).where(eq(matches.id, id));
}

/** A round-robin result: a draw is allowed, so there may be no winner. */
export async function recordGroupResult(
  db: Db,
  id: number,
  home: number | null,
  away: number | null,
) {
  const done = home !== null && away !== null;
  const [m] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!m) return;
  await db
    .update(matches)
    .set({
      homeScore: home,
      awayScore: away,
      status: done ? 'done' : 'scheduled',
      winnerTribuId: !done || home === away ? null : home > away ? m.homeTribuId : m.awayTribuId,
    })
    .where(eq(matches.id, id));
}

export async function deleteCompetition(db: Db, categoryId: number) {
  await db.delete(stages).where(eq(stages.categoryId, categoryId));
}
