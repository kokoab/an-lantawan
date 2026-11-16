import type { BracketMatch } from './bracket';
import type { StandingRow } from './standings';
import type { Medal } from './tally';

export interface Finish {
  tribuId: number;
  place: number;
}

const loserOf = (m: BracketMatch) =>
  m.winner === null ? null : m.winner === m.home ? m.away : m.home;

/**
 * Medals from a finished knockout. The final gives gold and silver. Bronze goes to the
 * third-place winner, the loser of the last lower-bracket match in double elimination, or
 * both semifinal losers when there was no third-place match. Null while matches are left.
 */
export function bracketMedals(matches: readonly BracketMatch[]): Finish[] | null {
  const final =
    matches.find((m) => m.key === 'GF') ??
    matches
      .filter((m) => m.stage === 'single' && m.key !== 'P3')
      .reduce<BracketMatch | null>(
        (top, m) => (top === null || m.round > top.round ? m : top),
        null,
      );
  if (!final || final.status !== 'done' || final.winner === null) return null;
  const out: Finish[] = [
    { tribuId: final.winner, place: 1 },
    { tribuId: loserOf(final) as number, place: 2 },
  ];
  const third = matches.find((m) => m.key === 'P3');
  if (third) {
    if (third.status !== 'done' || third.winner === null) return null;
    out.push({ tribuId: third.winner, place: 3 });
    return out;
  }
  if (final.key === 'GF') {
    const lower = matches.filter((m) => m.stage === 'lower');
    const last = lower.reduce<BracketMatch | null>(
      (top, m) => (top === null || m.round > top.round ? m : top),
      null,
    );
    const bronze = last ? loserOf(last) : null;
    if (bronze !== null) out.push({ tribuId: bronze, place: 3 });
    return out;
  }
  for (const semi of matches.filter((m) => m.stage === 'single' && m.round === final.round - 1)) {
    const bronze = loserOf(semi);
    if (bronze !== null) out.push({ tribuId: bronze, place: 3 });
  }
  return out;
}

/** Every finishing place from round-robin standings; tribus level on everything share a place. */
export const standingsFinishes = (rows: readonly StandingRow[]): Finish[] =>
  rows.map((r) => ({ tribuId: r.tribuId, place: r.rank }));

/** Places as the results form sends them: one place and mark per tribu, blanks skipped. */
export function readFinishes(
  entries: Array<{ tribuId: number; place: string; mark: string }>,
  tribuCount: number,
): { ok: true; finishes: Array<Finish & { mark: string | null }> } | { ok: false; error: string } {
  const finishes: Array<Finish & { mark: string | null }> = [];
  for (const e of entries) {
    const mark = e.mark.trim();
    if (mark.length > 60)
      return { ok: false, error: 'Keep each result under 60 characters, like 12.84 seconds.' };
    if (!e.place.trim()) {
      if (mark) return { ok: false, error: 'Give a place to every tribu that has a result.' };
      continue;
    }
    const place = Number(e.place);
    if (!Number.isInteger(place) || place < 1 || place > tribuCount) {
      return { ok: false, error: `Places go from 1 to ${tribuCount}.` };
    }
    finishes.push({ tribuId: e.tribuId, place, mark: mark || null });
  }
  return { ok: true, finishes };
}

export const isMedal = (place: number): place is Medal => place >= 1 && place <= 3;

export const MAX_MEDALS_EACH = 99;

/** One tribu's medals in a category with custom medals. */
export interface MedalCount {
  tribuId: number;
  place: Medal;
  count: number;
}

/**
 * Reads the custom medals form: how many golds, silvers and bronzes each tribu won.
 * Blank means none. Returns one row per medal a tribu actually has.
 */
export function readMedalCounts(
  entries: Array<{ tribuId: number; gold: string; silver: string; bronze: string }>,
): { ok: true; counts: MedalCount[] } | { ok: false; error: string } {
  const counts: MedalCount[] = [];
  for (const e of entries) {
    for (const [place, raw] of [
      [1, e.gold],
      [2, e.silver],
      [3, e.bronze],
    ] as const) {
      const text = raw.trim();
      if (!text) continue;
      const n = Number(text);
      if (!Number.isInteger(n) || n < 0 || n > MAX_MEDALS_EACH) {
        return { ok: false, error: `Medal counts are whole numbers from 0 to ${MAX_MEDALS_EACH}.` };
      }
      if (n > 0) counts.push({ tribuId: e.tribuId, place, count: n });
    }
  }
  return { ok: true, counts };
}

/** Turning custom medals on: each medal place becomes a count of one. Places 4+ go. */
export const finishesToCounts = (finishes: readonly Finish[]): MedalCount[] =>
  finishes.flatMap((f) =>
    isMedal(f.place) ? [{ tribuId: f.tribuId, place: f.place, count: 1 }] : [],
  );

/**
 * Turning custom medals off: each tribu keeps its best medal, as a single place. Extra
 * medals are dropped, which the admin warns about before switching.
 */
export function countsToFinishes(counts: readonly MedalCount[]): Finish[] {
  const best = new Map<number, number>();
  for (const c of counts) {
    const prev = best.get(c.tribuId);
    if (prev === undefined || c.place < prev) best.set(c.tribuId, c.place);
  }
  return [...best].map(([tribuId, place]) => ({ tribuId, place }));
}

/** Whether switching custom medals off would lose any medal. */
export const countsLoseMedals = (counts: readonly MedalCount[]) =>
  counts.reduce((n, c) => n + c.count, 0) > countsToFinishes(counts).length;
