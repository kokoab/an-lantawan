import { describe, expect, it } from 'vitest';
import { roundRobinRounds, standings } from './standings';

const m = (homeTribuId: number, awayTribuId: number, homeScore: number, awayScore: number) => ({
  homeTribuId,
  awayTribuId,
  homeScore,
  awayScore,
});

describe('standings', () => {
  it('awards 3 for a win, 1 for a draw, 0 for a loss', () => {
    const rows = standings([1, 2, 3], [m(1, 2, 2, 0), m(2, 3, 1, 1)]);
    expect(rows.map((r) => [r.tribuId, r.points])).toEqual([
      [1, 3],
      [3, 1],
      [2, 1],
    ]);
  });

  it('accepts a custom points rule, such as volleyball with no draws', () => {
    const rows = standings([1, 2], [m(1, 2, 3, 1)], { win: 2, draw: 0, loss: 1 });
    expect(rows.map((r) => r.points)).toEqual([2, 1]);
  });

  it('breaks a points tie on head-to-head before score difference', () => {
    // 1 and 2 finish on 6 points; 1 has the better difference but 2 beat 1.
    const rows = standings(
      [1, 2, 3, 4],
      [m(2, 1, 1, 0), m(1, 3, 10, 0), m(1, 4, 10, 0), m(2, 3, 1, 0), m(4, 2, 1, 0), m(3, 4, 1, 0)],
    );
    expect(rows[0].tribuId).toBe(2);
    expect(rows[1].tribuId).toBe(1);
  });

  it('shares a rank when every tiebreaker is level', () => {
    const rows = standings([1, 2], [m(1, 2, 1, 1)]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('lists tribus that have not played yet', () => {
    expect(standings([1, 2, 3], [m(1, 2, 1, 0)])).toHaveLength(3);
  });
});

describe('roundRobinRounds', () => {
  const pairKey = (a: number, b: number | null) => [a, b].sort().join('-');

  it('pairs every tribu with every other exactly once', () => {
    const rounds = roundRobinRounds([1, 2, 3, 4]);
    expect(rounds).toHaveLength(3);
    const pairs = rounds.flat().map(([a, b]) => pairKey(a, b));
    expect(new Set(pairs).size).toBe(6);
  });

  it('gives one bye per round with an odd number of tribus', () => {
    const rounds = roundRobinRounds([1, 2, 3, 4, 5]);
    expect(rounds).toHaveLength(5);
    for (const round of rounds) expect(round.filter(([, b]) => b === null)).toHaveLength(1);
    const games = rounds.flat().filter(([, b]) => b !== null);
    expect(new Set(games.map(([a, b]) => pairKey(a, b))).size).toBe(10);
  });
});

describe('standings with other rules and half points', () => {
  it('uses the stage rule and keeps half-point scores', () => {
    const rows = standings(
      [1, 2, 3],
      [
        { homeTribuId: 1, awayTribuId: 2, homeScore: 2.5, awayScore: 1.5 },
        { homeTribuId: 2, awayTribuId: 3, homeScore: 2, awayScore: 2 },
        { homeTribuId: 3, awayTribuId: 1, homeScore: 0.5, awayScore: 3.5 },
      ],
      { win: 2, draw: 1, loss: 0 },
    );
    expect(rows.map((r) => [r.tribuId, r.points, r.scored])).toEqual([
      [1, 4, 6],
      [2, 1, 3.5],
      [3, 1, 2.5],
    ]);
  });
});
