import { describe, expect, it } from 'vitest';
import { recordResult } from './bracket';
import {
  elimsAndPlayoffMedals,
  elimsRounds,
  legsOf,
  planMatches,
  playoffDraw,
  playoffEntrants,
  readFormat,
} from './format';
import { bracketMedals } from './medals';
import { type StandingRow, standings } from './standings';

const form = (elims: string, playoffs: string, advance = '', bronze = 'match') => ({
  elims,
  playoffs,
  advance,
  bronze,
});

describe('readFormat', () => {
  it('reads elims only, playoffs only, and both', () => {
    expect(readFormat(form('2', 'none'), 4)).toEqual({
      ok: true,
      value: { elims: 2, playoffs: 'none', advance: 0, thirdPlace: false },
    });
    expect(readFormat(form('0', 'knockout', '', 'shared'), 4)).toEqual({
      ok: true,
      value: { elims: 0, playoffs: 'knockout', advance: 4, thirdPlace: false },
    });
    expect(readFormat(form('1', 'knockout', '4'), 6)).toEqual({
      ok: true,
      value: { elims: 1, playoffs: 'knockout', advance: 4, thirdPlace: true },
    });
  });

  it('refuses a format with no matches at all', () => {
    expect(readFormat(form('0', 'none'), 4).ok).toBe(false);
  });

  it('refuses unknown choices instead of guessing', () => {
    expect(readFormat(form('3', 'none'), 4).ok).toBe(false);
    expect(readFormat(form('1', 'swiss'), 4).ok).toBe(false);
    expect(readFormat(form('', ''), 4).ok).toBe(false);
  });

  it('needs at least two tribus', () => {
    expect(readFormat(form('1', 'none'), 1).ok).toBe(false);
  });

  it('only sends 2, 4, 8 or 16 tribus to the playoffs, never more than are playing', () => {
    expect(readFormat(form('1', 'knockout', '3'), 6).ok).toBe(false);
    expect(readFormat(form('1', 'knockout', '8'), 4).ok).toBe(false);
    expect(readFormat(form('1', 'knockout', ''), 4).ok).toBe(false);
    expect(readFormat(form('2', 'knockout', '4'), 4).ok).toBe(true);
  });

  it('keeps double elimination to 4, 8 or 16 tribus', () => {
    expect(readFormat(form('0', 'double'), 4).ok).toBe(true);
    expect(readFormat(form('0', 'double'), 5).ok).toBe(false);
    expect(readFormat(form('0', 'double'), 3).ok).toBe(false);
    expect(readFormat(form('1', 'double', '2'), 4).ok).toBe(false);
    expect(readFormat(form('1', 'double', '4'), 5).ok).toBe(true);
  });
});

/** Every pairing of a schedule, as "low-high" so home and away don't matter. */
const pairCounts = (rounds: Array<Array<[number, number | null]>>) => {
  const counts = new Map<string, number>();
  for (const round of rounds) {
    for (const [a, b] of round) {
      if (b === null) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
};

describe('elimsRounds', () => {
  it('has every pair meet once in a single round robin', () => {
    const rounds = elimsRounds([1, 2, 3, 4], 1);
    expect(rounds).toHaveLength(3);
    expect([...pairCounts(rounds).values()]).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('has every pair meet twice in a double round robin, with home and away swapped', () => {
    const rounds = elimsRounds([1, 2, 3, 4], 2);
    expect(rounds).toHaveLength(6);
    const counts = pairCounts(rounds);
    expect(counts.size).toBe(6);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    const first = rounds.slice(0, 3).flat();
    const second = rounds.slice(3).flat();
    expect(second).toEqual(first.map(([a, b]) => [b, a]));
  });

  it('gives each tribu a rest round with an odd number of tribus', () => {
    const rounds = elimsRounds([1, 2, 3, 4, 5], 2);
    expect(rounds).toHaveLength(10);
    expect([...pairCounts(rounds).values()].every((n) => n === 2)).toBe(true);
    const rests = rounds
      .flat()
      .filter(([, b]) => b === null)
      .map(([a]) => a);
    expect(rests.sort()).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('never has a tribu play twice in one round', () => {
    for (const round of elimsRounds([1, 2, 3, 4, 5, 6], 2)) {
      const playing = round.flatMap(([a, b]) => (b === null ? [a] : [a, b]));
      expect(new Set(playing).size).toBe(playing.length);
    }
  });
});

describe('planMatches', () => {
  it('makes only elims when there are no playoffs', () => {
    const r = planMatches(
      { elims: 2, playoffs: 'none', advance: 0, thirdPlace: false },
      [1, 2, 3, 4],
    );
    expect(r.ok && r.value.rounds.flat().length).toBe(12);
    expect(r.ok && r.value.bracket).toEqual([]);
  });

  it('makes only a bracket, with the tribus in it, when there are no elims', () => {
    const r = planMatches(
      { elims: 0, playoffs: 'knockout', advance: 4, thirdPlace: true },
      [1, 2, 3, 4],
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.value.rounds).toEqual([]);
    const first = r.value.bracket.filter((m) => m.round === 1 && m.key !== 'P3');
    expect(first.map((m) => [m.home, m.away])).toEqual([
      [1, 4],
      [2, 3],
    ]);
  });

  it('leaves every playoff slot empty after elims, with no stand-ins left behind', () => {
    for (const playoffs of ['knockout', 'double'] as const) {
      const r = planMatches({ elims: 1, playoffs, advance: 4, thirdPlace: true }, [1, 2, 3, 4, 5]);
      if (!r.ok) throw new Error(r.error);
      expect(r.value.rounds.length).toBe(5);
      for (const m of r.value.bracket) {
        expect([m.home, m.away, m.winner]).toEqual([null, null, null]);
        expect(m.status).toBe('scheduled');
      }
    }
  });

  it('makes a lone final when the top 2 go on', () => {
    const r = planMatches(
      { elims: 2, playoffs: 'knockout', advance: 2, thirdPlace: true },
      [1, 2, 3, 4],
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.value.bracket.map((m) => m.key)).toEqual(['R1-1']);
  });
});

const row = (tribuId: number, rank: number): StandingRow =>
  ({ tribuId, rank }) as unknown as StandingRow;

describe('playoffEntrants', () => {
  it('takes the top tribus in order', () => {
    expect(playoffEntrants([row(3, 1), row(1, 2), row(4, 3), row(2, 4)], 2, 0)).toEqual({
      ok: true,
      value: [3, 1],
    });
  });

  it('waits until every elims match is played', () => {
    const r = playoffEntrants([row(1, 1), row(2, 2)], 2, 1);
    expect(r).toEqual({ ok: false, error: '1 elims match is still to be played.' });
  });

  it('refuses to pick between tribus level on everything across the cut', () => {
    expect(playoffEntrants([row(1, 1), row(2, 2), row(3, 2), row(4, 4)], 2, 0).ok).toBe(false);
  });

  it('allows ties that sit on the same side of the cut', () => {
    expect(playoffEntrants([row(1, 1), row(2, 1), row(3, 3), row(4, 3)], 2, 0)).toEqual({
      ok: true,
      value: [1, 2],
    });
  });

  it('allows the whole field to go on', () => {
    expect(playoffEntrants([row(1, 1), row(2, 2), row(3, 2), row(4, 4)], 4, 0).ok).toBe(true);
  });
});

describe('playoffDraw', () => {
  it('has 1 meet 4 and 2 meet 3 in the semifinals', () => {
    expect(playoffDraw('knockout', [10, 20, 30, 40], true)).toEqual({
      ok: true,
      value: [
        { position: 1, home: 10, away: 40 },
        { position: 2, home: 20, away: 30 },
      ],
    });
  });

  it('puts the top 2 in the final', () => {
    expect(playoffDraw('knockout', [10, 20], false)).toEqual({
      ok: true,
      value: [{ position: 1, home: 10, away: 20 }],
    });
  });

  it('draws the upper bracket for double elimination', () => {
    const r = playoffDraw('double', [10, 20, 30, 40], false);
    expect(r.ok && r.value).toEqual([
      { position: 1, home: 10, away: 40 },
      { position: 2, home: 20, away: 30 },
    ]);
  });
});

describe('elims, then playoffs, start to finish', () => {
  // Four tribus, double round robin, top 2 play a final.
  const ids = [1, 2, 3, 4];
  const played = elimsRounds(ids, 2)
    .flat()
    .map(([home, away]) => {
      // Lower IDs always win, so the table is 1, 2, 3, 4.
      const homeWins = home < (away as number);
      return {
        homeTribuId: home,
        awayTribuId: away as number,
        homeScore: homeWins ? 2 : 0,
        awayScore: homeWins ? 0 : 2,
      };
    });
  const table = standings(ids, played);

  it('sends the top 2 to the final and gives bronze to third place', () => {
    const top = playoffEntrants(table, 2, 0);
    if (!top.ok) throw new Error(top.error);
    expect(top.value).toEqual([1, 2]);

    const plan = planMatches({ elims: 2, playoffs: 'knockout', advance: 2, thirdPlace: true }, ids);
    if (!plan.ok) throw new Error(plan.error);
    const final = plan.value.bracket.map((m) => ({ ...m, home: 1, away: 2 }));
    expect(bracketMedals(final)).toBeNull();
    expect(elimsAndPlayoffMedals(bracketMedals(final), table, top.value)).toBeNull();

    // Second place wins the final.
    const done = recordResult(final, 'R1-1', 1, 3);
    if (!done.ok) throw new Error(done.error);
    expect(elimsAndPlayoffMedals(bracketMedals(done.value), table, top.value)).toEqual([
      { tribuId: 2, place: 1 },
      { tribuId: 1, place: 2 },
      { tribuId: 3, place: 3 },
    ]);
  });

  it('gives bronze to both tribus tied for the best place outside the cut', () => {
    const tied = [row(1, 1), row(2, 2), row(3, 3), row(4, 3)];
    expect(
      elimsAndPlayoffMedals(
        [
          { tribuId: 1, place: 1 },
          { tribuId: 2, place: 2 },
        ],
        tied,
        [1, 2],
      ),
    ).toEqual([
      { tribuId: 1, place: 1 },
      { tribuId: 2, place: 2 },
      { tribuId: 3, place: 3 },
      { tribuId: 4, place: 3 },
    ]);
  });

  it('keeps the playoff bronze when there were semifinals', () => {
    const medals = [
      { tribuId: 1, place: 1 },
      { tribuId: 2, place: 2 },
      { tribuId: 4, place: 3 },
    ];
    expect(elimsAndPlayoffMedals(medals, table, [1, 2, 3, 4])).toEqual(medals);
  });
});

describe('legsOf', () => {
  it('counts how often the tribus meet', () => {
    const once = elimsRounds([1, 2, 3, 4], 1).flat();
    const twice = elimsRounds([1, 2, 3, 4, 5], 2).flat();
    expect(legsOf(once)).toBe(1);
    expect(legsOf(twice)).toBe(2);
    expect(legsOf([])).toBe(1);
  });
});
