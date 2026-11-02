export type Medal = 1 | 2 | 3;

export interface Placement {
  tribuId: number;
  place: Medal;
}

export interface TallyRow {
  tribuId: number;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  /** Tribus with the same gold, silver and bronze share a rank (1, 1, 3). */
  rank: number;
}

const byMedals = (a: TallyRow, b: TallyRow) =>
  b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze;

/**
 * The medal tally, ranked by golds, then silvers, then bronzes.
 * Every participating tribu gets a row, including those with no medals yet.
 */
export function medalTally(
  tribuIds: readonly number[],
  placements: readonly Placement[],
): TallyRow[] {
  const rows = new Map<number, TallyRow>();
  const row = (tribuId: number) => {
    let r = rows.get(tribuId);
    if (!r) {
      r = { tribuId, gold: 0, silver: 0, bronze: 0, total: 0, rank: 0 };
      rows.set(tribuId, r);
    }
    return r;
  };

  for (const id of tribuIds) row(id);
  for (const { tribuId, place } of placements) {
    const r = row(tribuId);
    if (place === 1) r.gold++;
    else if (place === 2) r.silver++;
    else r.bronze++;
    r.total++;
  }

  const sorted = [...rows.values()].sort(
    (a, b) => byMedals(a, b) || tribuIds.indexOf(a.tribuId) - tribuIds.indexOf(b.tribuId),
  );
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    r.rank = prev && byMedals(prev, r) === 0 ? prev.rank : i + 1;
  });
  return sorted;
}
