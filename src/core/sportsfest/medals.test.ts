import { describe, expect, it } from 'vitest';
import { type BracketMatch, doubleElimination, recordResult, singleElimination } from './bracket';
import { bracketMedals, readFinishes, standingsFinishes } from './medals';
import { standings } from './standings';

const play = (bracket: BracketMatch[], results: Record<string, [number, number]>) => {
  let b = bracket;
  for (const [key, [h, a]] of Object.entries(results)) {
    const r = recordResult(b, key, h, a);
    if (!r.ok) throw new Error(r.error);
    b = r.value;
  }
  return b;
};
const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('bracketMedals', () => {
  it('reads gold, silver and the third-place winner from a single elimination', () => {
    const b = unwrap(singleElimination([1, 2, 3, 4], { thirdPlace: true }));
    // Seeds 1v4 and 2v3; 4 upsets 1, 2 beats 3; 4 wins the final; 1 takes bronze.
    expect(bracketMedals(b)).toBeNull();
    const done = play(b, { 'R1-1': [50, 60], 'R1-2': [70, 65], 'R2-1': [80, 75], P3: [61, 59] });
    expect(bracketMedals(done)).toEqual([
      { tribuId: 4, place: 1 },
      { tribuId: 2, place: 2 },
      { tribuId: 1, place: 3 },
    ]);
  });

  it('gives both semifinal losers bronze without a third-place match', () => {
    const b = play(unwrap(singleElimination([1, 2, 3, 4])), {
      'R1-1': [2, 1],
      'R1-2': [0, 3],
      'R2-1': [1, 2],
    });
    expect(bracketMedals(b)).toEqual([
      { tribuId: 3, place: 1 },
      { tribuId: 1, place: 2 },
      { tribuId: 4, place: 3 },
      { tribuId: 2, place: 3 },
    ]);
  });

  it('waits for the third-place match before giving medals', () => {
    const b = play(unwrap(singleElimination([1, 2, 3, 4], { thirdPlace: true })), {
      'R1-1': [2, 1],
      'R1-2': [3, 0],
      'R2-1': [1, 0],
    });
    expect(bracketMedals(b)).toBeNull();
  });

  it('handles byes with three tribus', () => {
    // Seed 1 has a bye; 2 beats 3, then 1 beats 2 in the final.
    const b = play(unwrap(singleElimination([1, 2, 3])), { 'R1-2': [5, 3], 'R2-1': [4, 2] });
    expect(bracketMedals(b)).toEqual([
      { tribuId: 1, place: 1 },
      { tribuId: 2, place: 2 },
      { tribuId: 3, place: 3 },
    ]);
  });

  it('reads double elimination: grand final, then the last lower-bracket loser', () => {
    const b = play(unwrap(doubleElimination([1, 2, 3, 4])), {
      'U1-1': [3, 0], // 1 beats 4
      'U1-2': [3, 1], // 2 beats 3
      'U2-1': [3, 2], // 1 beats 2, 2 drops
      'L1-1': [3, 1], // 4 beats 3
      'L2-1': [1, 3], // 2 beats 4: away (2) wins
      GF: [2, 3], // 2 wins the grand final
    });
    expect(bracketMedals(b)).toEqual([
      { tribuId: 2, place: 1 },
      { tribuId: 1, place: 2 },
      { tribuId: 4, place: 3 },
    ]);
  });
});

describe('standingsFinishes', () => {
  it('turns round-robin ranks into places, ties sharing', () => {
    const rows = standings(
      [1, 2, 3],
      [
        { homeTribuId: 1, awayTribuId: 2, homeScore: 2, awayScore: 2 },
        { homeTribuId: 2, awayTribuId: 3, homeScore: 2, awayScore: 2 },
        { homeTribuId: 3, awayTribuId: 1, homeScore: 2, awayScore: 2 },
      ],
    );
    expect(standingsFinishes(rows).map((f) => f.place)).toEqual([1, 1, 1]);
  });
});

describe('readFinishes', () => {
  it('reads places and marks and skips blanks', () => {
    expect(
      readFinishes(
        [
          { tribuId: 1, place: '1', mark: ' 12.84 seconds ' },
          { tribuId: 2, place: '', mark: '' },
          { tribuId: 3, place: '3', mark: '' },
        ],
        4,
      ),
    ).toEqual({
      ok: true,
      finishes: [
        { tribuId: 1, place: 1, mark: '12.84 seconds' },
        { tribuId: 3, place: 3, mark: null },
      ],
    });
  });

  it('allows ties and refuses places out of range or marks without a place', () => {
    expect(
      readFinishes(
        [
          { tribuId: 1, place: '3', mark: '' },
          { tribuId: 2, place: '3', mark: '' },
        ],
        4,
      ).ok,
    ).toBe(true);
    expect(readFinishes([{ tribuId: 1, place: '5', mark: '' }], 4)).toEqual({
      ok: false,
      error: 'Places go from 1 to 4.',
    });
    expect(readFinishes([{ tribuId: 1, place: '', mark: '12.1' }], 4).ok).toBe(false);
  });
});
