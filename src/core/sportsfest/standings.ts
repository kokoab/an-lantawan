export interface PlayedMatch {
  homeTribuId: number;
  awayTribuId: number;
  homeScore: number;
  awayScore: number;
}

export interface PointsRule {
  win: number;
  draw: number;
  loss: number;
}

export const DEFAULT_POINTS: PointsRule = { win: 3, draw: 1, loss: 0 };

export interface StandingRow {
  tribuId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  difference: number;
  points: number;
  /** Tribus still level after every tiebreaker share a rank. */
  rank: number;
}

function tableFor(tribuIds: readonly number[], played: readonly PlayedMatch[], rule: PointsRule) {
  const rows = new Map<number, StandingRow>(
    tribuIds.map((tribuId) => [
      tribuId,
      {
        tribuId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        scored: 0,
        conceded: 0,
        difference: 0,
        points: 0,
        rank: 0,
      },
    ]),
  );
  const add = (id: number, scored: number, conceded: number) => {
    const r = rows.get(id);
    if (!r) return;
    r.played++;
    r.scored += scored;
    r.conceded += conceded;
    r.difference = r.scored - r.conceded;
    if (scored > conceded) {
      r.won++;
      r.points += rule.win;
    } else if (scored === conceded) {
      r.drawn++;
      r.points += rule.draw;
    } else {
      r.lost++;
      r.points += rule.loss;
    }
  };
  for (const m of played) {
    add(m.homeTribuId, m.homeScore, m.awayScore);
    add(m.awayTribuId, m.awayScore, m.homeScore);
  }
  return rows;
}

/**
 * Round-robin standings. Order: points, then points in the matches between the tied
 * tribus (head-to-head), then score difference, then scores made.
 */
export function standings(
  tribuIds: readonly number[],
  played: readonly PlayedMatch[],
  rule: PointsRule = DEFAULT_POINTS,
): StandingRow[] {
  const rows = [...tableFor(tribuIds, played, rule).values()];

  // Head-to-head points, computed separately for each group of tribus level on points.
  const headToHead = new Map<number, number>();
  const byPoints = Map.groupBy(rows, (r) => r.points);
  for (const group of byPoints.values()) {
    if (group.length < 2) continue;
    const ids = new Set(group.map((r) => r.tribuId));
    const between = played.filter((m) => ids.has(m.homeTribuId) && ids.has(m.awayTribuId));
    for (const r of tableFor([...ids], between, rule).values()) headToHead.set(r.tribuId, r.points);
  }

  const compare = (a: StandingRow, b: StandingRow) =>
    b.points - a.points ||
    (headToHead.get(b.tribuId) ?? 0) - (headToHead.get(a.tribuId) ?? 0) ||
    b.difference - a.difference ||
    b.scored - a.scored;

  rows.sort((a, b) => compare(a, b) || tribuIds.indexOf(a.tribuId) - tribuIds.indexOf(b.tribuId));
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && compare(prev, r) === 0 ? prev.rank : i + 1;
  });
  return rows;
}

/**
 * Pairings for a full round robin using the circle method. With an odd number of
 * tribus, one tribu sits out each round (shown as a bye).
 */
export function roundRobinRounds(
  tribuIds: readonly number[],
): Array<Array<[number, number | null]>> {
  const ids: Array<number | null> = [...tribuIds];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const rounds: Array<Array<[number, number | null]>> = [];

  for (let r = 0; r < n - 1; r++) {
    const round: Array<[number, number | null]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      if (a === null && b === null) continue;
      if (a === null) round.push([b as number, null]);
      else round.push(r % 2 === 0 ? [a, b] : b === null ? [a, null] : [b, a]);
    }
    rounds.push(round);
    // Keep the first entry fixed and rotate the rest one step.
    ids.splice(1, 0, ids.pop() as number | null);
  }
  return rounds;
}
