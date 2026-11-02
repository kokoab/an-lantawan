import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { archivedAt, id, oneOf } from './columns';
import { media, stories } from './publishing';

/** Tribus carry over from year to year; `sportsfestTribus` says who joined which year. */
export const tribus = sqliteTable('tribus', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  color: text('color').notNull(),
  logoId: integer('logo_id').references(() => media.id, { onDelete: 'set null' }),
  sort: integer('sort').notNull().default(0),
  archivedAt: archivedAt(),
});

export const SPORTSFEST_STATUSES = ['upcoming', 'ongoing', 'final'] as const;

export const sportsfests = sqliteTable(
  'sportsfests',
  {
    id: id(),
    year: integer('year').notNull().unique(),
    name: text('name').notNull(),
    theme: text('theme'),
    status: text('status', { enum: SPORTSFEST_STATUSES }).notNull().default('upcoming'),
    startsOn: text('starts_on'),
    endsOn: text('ends_on'),
  },
  (t) => [oneOf('sportsfests_status', t.status, SPORTSFEST_STATUSES)],
);

export const sportsfestTribus = sqliteTable(
  'sportsfest_tribus',
  {
    sportsfestId: integer('sportsfest_id')
      .notNull()
      .references(() => sportsfests.id, { onDelete: 'cascade' }),
    tribuId: integer('tribu_id')
      .notNull()
      .references(() => tribus.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.sportsfestId, t.tribuId] })],
);

export const EVENT_TYPES = ['bracket', 'race', 'judged', 'mind'] as const;
export const EVENT_STATUSES = ['scheduled', 'ongoing', 'done', 'postponed', 'cancelled'] as const;

export const events = sqliteTable(
  'events',
  {
    id: id(),
    sportsfestId: integer('sportsfest_id')
      .notNull()
      .references(() => sportsfests.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: text('type', { enum: EVENT_TYPES }).notNull(),
    status: text('status', { enum: EVENT_STATUSES }).notNull().default('scheduled'),
    venue: text('venue'),
    startsAt: integer('starts_at', { mode: 'timestamp' }),
    note: text('note'),
  },
  (t) => [
    uniqueIndex('events_slug').on(t.sportsfestId, t.slug),
    oneOf('events_type', t.type, EVENT_TYPES),
    oneOf('events_status', t.status, EVENT_STATUSES),
  ],
);

/** Men's, Women's, Mixed… Medals are awarded per category. */
export const categories = sqliteTable('categories', {
  id: id(),
  eventId: integer('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sort: integer('sort').notNull().default(0),
});

/**
 * Where each tribu finished in a category. Places 1 to 3 are the medals; later places are
 * kept for the full results. Place is not unique, so ties (two bronzes) are allowed, but a
 * tribu finishes only once per category.
 */
export const placements = sqliteTable(
  'placements',
  {
    id: id(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    tribuId: integer('tribu_id')
      .notNull()
      .references(() => tribus.id, { onDelete: 'restrict' }),
    place: integer('place').notNull(),
    /** Time, distance or score shown beside the place, e.g. "12.41 seconds". */
    mark: text('mark'),
  },
  (t) => [
    uniqueIndex('placements_tribu').on(t.categoryId, t.tribuId),
    check('placements_place', sql`${t.place} >= 1`),
  ],
);

export const STAGE_KINDS = ['single', 'upper', 'lower', 'final', 'group'] as const;

/** Parts of a category's competition: a group, the upper or lower bracket, the final. */
export const stages = sqliteTable(
  'stages',
  {
    id: id(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: STAGE_KINDS }).notNull(),
    name: text('name').notNull(),
    sort: integer('sort').notNull().default(0),
    /** Round-robin points. Chess, for one, gives 2 for a win and 1 for a draw. */
    pointsWin: real('points_win').notNull().default(3),
    pointsDraw: real('points_draw').notNull().default(1),
    pointsLoss: real('points_loss').notNull().default(0),
  },
  (t) => [oneOf('stages_kind', t.kind, STAGE_KINDS)],
);

/** Tribus in a round-robin group, with their seed. */
export const stageEntries = sqliteTable(
  'stage_entries',
  {
    stageId: integer('stage_id')
      .notNull()
      .references(() => stages.id, { onDelete: 'cascade' }),
    tribuId: integer('tribu_id')
      .notNull()
      .references(() => tribus.id, { onDelete: 'restrict' }),
    seed: integer('seed'),
  },
  (t) => [primaryKey({ columns: [t.stageId, t.tribuId] })],
);

export const MATCH_STATUSES = [
  'scheduled',
  'ongoing',
  'done',
  'postponed',
  'cancelled',
  'bye',
] as const;
export const SLOTS = ['home', 'away'] as const;

/**
 * A bracket is a graph: each match says where its winner (and, in double elimination,
 * its loser) goes next. Tribus stay empty until an earlier match decides them.
 */
export const matches = sqliteTable(
  'matches',
  {
    id: id(),
    stageId: integer('stage_id')
      .notNull()
      .references(() => stages.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    position: integer('position').notNull(),
    homeTribuId: integer('home_tribu_id').references(() => tribus.id, { onDelete: 'restrict' }),
    awayTribuId: integer('away_tribu_id').references(() => tribus.id, { onDelete: 'restrict' }),
    /** Real numbers, so chess can score half points (2½–1½). */
    homeScore: real('home_score'),
    awayScore: real('away_score'),
    winnerTribuId: integer('winner_tribu_id').references(() => tribus.id, { onDelete: 'restrict' }),
    status: text('status', { enum: MATCH_STATUSES }).notNull().default('scheduled'),
    startsAt: integer('starts_at', { mode: 'timestamp' }),
    venue: text('venue'),
    winnerToMatchId: integer('winner_to_match_id').references((): AnySQLiteColumn => matches.id, {
      onDelete: 'set null',
    }),
    winnerToSlot: text('winner_to_slot', { enum: SLOTS }),
    loserToMatchId: integer('loser_to_match_id').references((): AnySQLiteColumn => matches.id, {
      onDelete: 'set null',
    }),
    loserToSlot: text('loser_to_slot', { enum: SLOTS }),
  },
  (t) => [
    uniqueIndex('matches_slot').on(t.stageId, t.round, t.position),
    oneOf('matches_status', t.status, MATCH_STATUSES),
    check(
      'matches_teams_differ',
      sql`${t.homeTribuId} is null or ${t.homeTribuId} <> ${t.awayTribuId}`,
    ),
  ],
);

/** Set scores for volleyball, badminton, table tennis… */
export const matchSets = sqliteTable(
  'match_sets',
  {
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    n: integer('n').notNull(),
    home: integer('home').notNull(),
    away: integer('away').notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.n] })],
);

/** Coverage linked to an event, shown on the event page. */
export const storyEvents = sqliteTable(
  'story_events',
  {
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.storyId, t.eventId] }),
    index('story_events_event').on(t.eventId),
  ],
);
