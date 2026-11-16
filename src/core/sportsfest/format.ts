import { type BracketMatch, doubleElimination, type Result, singleElimination } from './bracket';
import { roundRobinRounds, type StandingRow } from './standings';

/**
 * How a category's matches are played, built from two parts:
 * elims (everyone plays everyone, once or twice) and playoffs (a knockout or double
 * elimination). Either part can be left out, but not both.
 */
export interface FormatPlan {
  /** Times each pair of tribus meets in the elims: 0 (no elims), 1 or 2. */
  elims: 0 | 1 | 2;
  playoffs: 'none' | 'knockout' | 'double';
  /** Tribus in the playoffs. Without elims, every tribu taking part. */
  advance: number;
  /** A match for bronze between the semifinal losers, instead of both getting bronze. */
  thirdPlace: boolean;
}

/** Playoff sizes after elims. Powers of two, so nobody gets a bye into the playoffs. */
export const PLAYOFF_SIZES = [2, 4, 8, 16] as const;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });
const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

/** Reads the format form for a category with this many tribus taking part. */
export function readFormat(
  input: { elims: string; playoffs: string; advance: string; bronze: string },
  entrants: number,
): Result<FormatPlan> {
  const elims = input.elims === '2' ? 2 : input.elims === '1' ? 1 : input.elims === '0' ? 0 : null;
  const playoffs =
    input.playoffs === 'knockout' || input.playoffs === 'double' || input.playoffs === 'none'
      ? input.playoffs
      : null;
  if (elims === null || playoffs === null) return fail('Choose the elims and the playoffs.');
  if (entrants < 2) return fail('Choose at least two tribus.');
  if (elims === 0 && playoffs === 'none') {
    return fail('Choose elims, playoffs or both. Without either there are no matches.');
  }
  const thirdPlace = input.bronze === 'match';

  if (elims === 0) {
    if (playoffs === 'double' && (entrants < 4 || !isPowerOfTwo(entrants))) {
      return fail(
        `Double elimination needs 4, 8 or 16 tribus (${entrants} are playing). Add elims before it, or use a knockout.`,
      );
    }
    return ok({ elims, playoffs, advance: entrants, thirdPlace });
  }

  if (playoffs === 'none') return ok({ elims, playoffs, advance: 0, thirdPlace: false });
  const advance = Number(input.advance);
  if (!PLAYOFF_SIZES.includes(advance as (typeof PLAYOFF_SIZES)[number])) {
    return fail('Choose how many tribus go on to the playoffs: 2, 4, 8 or 16.');
  }
  if (advance > entrants) {
    return fail(`Only ${entrants} tribus are playing, so the top ${advance} can’t go on.`);
  }
  if (playoffs === 'double' && advance < 4) {
    return fail('Double elimination needs at least 4 tribus in the playoffs.');
  }
  return ok({ elims, playoffs, advance, thirdPlace });
}

/** Pairings for the elims: a round robin, played a second time with home and away swapped. */
export function elimsRounds(
  tribuIds: readonly number[],
  legs: 1 | 2,
): Array<Array<[number, number | null]>> {
  const first = roundRobinRounds(tribuIds);
  if (legs === 1) return first;
  const second = first.map((round) =>
    round.map(([a, b]): [number, number | null] => (b === null ? [a, null] : [b, a])),
  );
  return [...first, ...second];
}

/** Every match of a format, ready to save. Playoffs after elims start with empty slots. */
export function planMatches(
  plan: FormatPlan,
  entrants: readonly number[],
): Result<{ rounds: Array<Array<[number, number | null]>>; bracket: BracketMatch[] }> {
  const rounds = plan.elims === 0 ? [] : elimsRounds(entrants, plan.elims);
  if (plan.playoffs === 'none') return ok({ rounds, bracket: [] });

  // After elims, nobody knows yet who goes on, so the bracket is drawn with stand-ins
  // and their slots are emptied. "Send the top tribus on" fills them later.
  const players = plan.elims === 0 ? entrants : standIns(plan.advance);
  const made =
    plan.playoffs === 'double'
      ? doubleElimination(players)
      : singleElimination(players, { thirdPlace: plan.thirdPlace });
  if (!made.ok) return made;
  if (plan.elims > 0) {
    for (const m of made.value) {
      m.home = null;
      m.away = null;
      m.winner = null;
      m.status = 'scheduled';
    }
  }
  return ok({ rounds, bracket: made.value });
}

const standIns = (n: number) => Array.from({ length: n }, (_, i) => -(i + 1));

/**
 * The tribus that go on to the playoffs, best first. Fails while elims are unplayed, or
 * when tribus level on everything sit on both sides of the cut: editors decide those.
 */
export function playoffEntrants(
  rows: readonly StandingRow[],
  advance: number,
  unplayed: number,
): Result<number[]> {
  if (unplayed > 0) {
    return fail(
      `${unplayed} elims ${unplayed === 1 ? 'match is' : 'matches are'} still to be played.`,
    );
  }
  if (rows.length < advance) return fail(`Only ${rows.length} tribus played the elims.`);
  const last = rows[advance - 1];
  const next = rows[advance];
  if (next && next.rank === last.rank) {
    return fail(
      'Tribus level on everything sit on both sides of the playoff cut. Set the playoff tribus by hand in each match.',
    );
  }
  return ok(rows.slice(0, advance).map((r) => r.tribuId));
}

/**
 * Round-one pairings of the playoffs for these tribus, best first: the same draw the
 * bracket was built with, so 1 meets 4 and 2 meets 3.
 */
export function playoffDraw(
  playoffs: 'knockout' | 'double',
  ordered: readonly number[],
  thirdPlace: boolean,
): Result<Array<{ position: number; home: number | null; away: number | null }>> {
  const made =
    playoffs === 'double' ? doubleElimination(ordered) : singleElimination(ordered, { thirdPlace });
  if (!made.ok) return made;
  const stage = playoffs === 'double' ? 'upper' : 'single';
  return ok(
    made.value
      .filter((m) => m.stage === stage && m.round === 1 && m.key !== 'P3')
      .map((m) => ({ position: m.position, home: m.home, away: m.away })),
  );
}

/**
 * Medals when elims lead into playoffs. Gold and silver come from the playoffs. Bronze
 * does too when there were semifinals; with only a final, it goes to the best tribu that
 * missed the cut. Null until the playoffs are decided.
 */
export function elimsAndPlayoffMedals(
  playoffMedals: ReadonlyArray<{ tribuId: number; place: number }> | null,
  rows: readonly StandingRow[],
  playoffTribus: readonly number[],
): Array<{ tribuId: number; place: number }> | null {
  if (!playoffMedals) return null;
  if (playoffMedals.some((f) => f.place === 3)) return [...playoffMedals];
  const out = rows.filter((r) => !playoffTribus.includes(r.tribuId));
  if (!out.length) return [...playoffMedals];
  const best = out[0].rank;
  return [
    ...playoffMedals,
    ...out.filter((r) => r.rank === best).map((r) => ({ tribuId: r.tribuId, place: 3 })),
  ];
}

/** How many times the tribus of a round robin meet: 2 for a double round robin. */
export function legsOf(pairs: ReadonlyArray<[number | null, number | null]>): number {
  const met = new Map<string, number>();
  for (const [a, b] of pairs) {
    if (a === null || b === null) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    met.set(key, (met.get(key) ?? 0) + 1);
  }
  return Math.max(1, ...met.values());
}
