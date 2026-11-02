import { describe, expect, it } from 'vitest';
import {
  type BracketMatch,
  clearResult,
  doubleElimination,
  type Result,
  recordResult,
  seedOrder,
  singleElimination,
} from './bracket';

const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const get = (ms: BracketMatch[], key: string) => {
  const m = ms.find((x) => x.key === key);
  if (!m) throw new Error(`no match ${key}`);
  return m;
};
/** Plays a match so that the home side wins. */
const homeWins = (ms: BracketMatch[], key: string) => unwrap(recordResult(ms, key, 2, 1));
const awayWins = (ms: BracketMatch[], key: string) => unwrap(recordResult(ms, key, 1, 2));

describe('seedOrder', () => {
  it('keeps top seeds apart until the end', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('singleElimination', () => {
  it('builds a 4-tribu bracket that ends in one final', () => {
    const ms = unwrap(singleElimination([10, 20, 30, 40]));
    expect(ms.map((m) => m.key)).toEqual(['R1-1', 'R1-2', 'R2-1']);
    expect(get(ms, 'R1-1')).toMatchObject({ home: 10, away: 40 });
    expect(get(ms, 'R1-2').winnerTo).toEqual({ key: 'R2-1', slot: 'away' });
  });

  it('gives byes to the top seeds when the count is not a power of two', () => {
    const ms = unwrap(singleElimination([1, 2, 3, 4, 5]));
    const byes = ms.filter((m) => m.status === 'bye');
    expect(byes.map((m) => m.winner).sort()).toEqual([1, 2, 3]);
    expect(get(ms, 'R2-1').home).toBe(1);
  });

  it('sends semifinal losers to a third-place match when asked', () => {
    let ms = unwrap(singleElimination([1, 2, 3, 4], { thirdPlace: true }));
    ms = homeWins(ms, 'R1-1');
    ms = awayWins(ms, 'R1-2');
    expect(get(ms, 'P3')).toMatchObject({ home: 4, away: 2 });
    expect(get(ms, 'R2-1')).toMatchObject({ home: 1, away: 3 });
  });

  it('refuses fewer than two tribus', () => {
    expect(singleElimination([1]).ok).toBe(false);
  });
});

describe('doubleElimination', () => {
  it('builds upper, lower and grand final for 4 and 8 tribus', () => {
    expect(unwrap(doubleElimination([1, 2, 3, 4]))).toHaveLength(6);
    expect(unwrap(doubleElimination([1, 2, 3, 4, 5, 6, 7, 8]))).toHaveLength(14);
  });

  it('drops upper-bracket losers into the lower bracket', () => {
    let ms = unwrap(doubleElimination([1, 2, 3, 4]));
    ms = homeWins(ms, 'U1-1'); // 1 beats 4
    ms = homeWins(ms, 'U1-2'); // 2 beats 3
    expect(get(ms, 'L1-1')).toMatchObject({ home: 4, away: 3 });
    ms = homeWins(ms, 'U2-1'); // 1 beats 2
    ms = awayWins(ms, 'L1-1'); // 3 beats 4
    expect(get(ms, 'L2-1')).toMatchObject({ home: 3, away: 2 });
    ms = awayWins(ms, 'L2-1'); // 2 beats 3
    expect(get(ms, 'GF')).toMatchObject({ home: 1, away: 2 });
  });

  it('feeds every lower-bracket slot exactly once with 8 tribus', () => {
    const ms = unwrap(doubleElimination([1, 2, 3, 4, 5, 6, 7, 8]));
    const fed = new Map<string, number>();
    for (const m of ms) {
      for (const link of [m.winnerTo, m.loserTo]) {
        if (!link) continue;
        const id = `${link.key}:${link.slot}`;
        fed.set(id, (fed.get(id) ?? 0) + 1);
      }
    }
    const firstRound = ms.filter((m) => m.stage === 'upper' && m.round === 1);
    const expectedSlots = (ms.length - firstRound.length) * 2;
    expect(fed.size).toBe(expectedSlots);
    expect([...fed.values()].every((n) => n === 1)).toBe(true);
  });

  it('explains which sizes it supports', () => {
    const r = doubleElimination([1, 2, 3, 4, 5, 6]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('has 6');
  });
});

describe('recordResult', () => {
  const fresh = () => unwrap(singleElimination([1, 2, 3, 4]));

  it('rejects a draw', () => {
    expect(recordResult(fresh(), 'R1-1', 1, 1).ok).toBe(false);
  });

  it('rejects a score before both tribus are known', () => {
    expect(recordResult(fresh(), 'R2-1', 1, 0).ok).toBe(false);
  });

  it('lets an earlier result change while the next match is unplayed', () => {
    let ms = homeWins(fresh(), 'R1-1');
    ms = awayWins(ms, 'R1-1');
    expect(get(ms, 'R2-1').home).toBe(4);
  });

  it('blocks changing a result the next match already used', () => {
    let ms = homeWins(fresh(), 'R1-1');
    ms = homeWins(ms, 'R1-2');
    ms = homeWins(ms, 'R2-1');
    const r = recordResult(ms, 'R1-1', 0, 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Round 2, match 1');
  });

  it('does not change the bracket it was given', () => {
    const ms = fresh();
    homeWins(ms, 'R1-1');
    expect(get(ms, 'R1-1').status).toBe('scheduled');
  });
});

describe('clearResult', () => {
  it('takes the winner back out of the next match', () => {
    let ms = homeWins(unwrap(singleElimination([1, 2, 3, 4])), 'R1-1');
    ms = unwrap(clearResult(ms, 'R1-1'));
    expect(get(ms, 'R2-1').home).toBeNull();
    expect(get(ms, 'R1-1').status).toBe('scheduled');
  });
});
