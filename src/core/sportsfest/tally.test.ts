import { describe, expect, it } from 'vitest';
import { medalTally } from './tally';

describe('medalTally', () => {
  it('ranks by gold, then silver, then bronze', () => {
    const rows = medalTally(
      [1, 2, 3],
      [
        { tribuId: 2, place: 1 },
        { tribuId: 1, place: 2 },
        { tribuId: 1, place: 2 },
        { tribuId: 3, place: 2 },
        { tribuId: 3, place: 3 },
      ],
    );
    expect(rows.map((r) => [r.tribuId, r.rank])).toEqual([
      [2, 1],
      [1, 2],
      [3, 3],
    ]);
    expect(rows[1]).toMatchObject({ gold: 0, silver: 2, bronze: 0, total: 2 });
  });

  it('lists tribus with no medals yet', () => {
    const rows = medalTally([1, 2], [{ tribuId: 1, place: 3 }]);
    expect(rows[1]).toMatchObject({ tribuId: 2, total: 0, rank: 2 });
  });

  it('shares a rank on identical medals and skips the next rank', () => {
    const rows = medalTally(
      [1, 2, 3],
      [
        { tribuId: 1, place: 1 },
        { tribuId: 2, place: 1 },
        { tribuId: 3, place: 2 },
      ],
    );
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('counts tied places, such as two bronzes in one category', () => {
    const rows = medalTally(
      [1, 2],
      [
        { tribuId: 1, place: 3 },
        { tribuId: 2, place: 3 },
      ],
    );
    expect(rows.every((r) => r.bronze === 1 && r.rank === 1)).toBe(true);
  });

  it('works with any number of tribus', () => {
    const ids = [1, 2, 3, 4, 5, 6];
    expect(medalTally(ids, [])).toHaveLength(6);
  });
});
