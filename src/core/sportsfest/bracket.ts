export type Slot = 'home' | 'away';
export type BracketStage = 'single' | 'upper' | 'lower' | 'final';

export interface Link {
  key: string;
  slot: Slot;
}

/**
 * A match in a generated bracket. `key` is stable within the bracket (e.g. "U2-1") and is
 * mapped to database IDs when the bracket is saved.
 */
export interface BracketMatch {
  key: string;
  stage: BracketStage;
  round: number;
  position: number;
  home: number | null;
  away: number | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: number | null;
  status: 'scheduled' | 'done' | 'bye';
  winnerTo: Link | null;
  loserTo: Link | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

const slotFor = (position: number): Slot => (position % 2 === 1 ? 'home' : 'away');
const half = (position: number) => Math.ceil(position / 2);
const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

function blank(key: string, stage: BracketStage, round: number, position: number): BracketMatch {
  return {
    key,
    stage,
    round,
    position,
    home: null,
    away: null,
    homeScore: null,
    awayScore: null,
    winner: null,
    status: 'scheduled',
    winnerTo: null,
    loserTo: null,
  };
}

/** Standard seeding so the top seeds meet as late as possible: 8 → 1,8,4,5,2,7,3,6. */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((s) => [s, sum - s]);
  }
  return order.slice(0, size);
}

/** Moves the only entrant of a round-one match through to the next round. */
function applyByes(matches: BracketMatch[]) {
  const byKey = new Map(matches.map((m) => [m.key, m]));
  for (const m of matches) {
    if (m.round !== 1 || m.stage === 'lower') continue;
    const only = m.home === null ? m.away : m.away === null ? m.home : null;
    if (only === null) continue;
    m.status = 'bye';
    m.winner = only;
    const next = m.winnerTo && byKey.get(m.winnerTo.key);
    if (next && m.winnerTo) next[m.winnerTo.slot] = only;
  }
}

function fillRoundOne(matches: BracketMatch[], entrants: readonly number[], size: number) {
  const seeds = seedOrder(size);
  matches.forEach((m, i) => {
    m.home = entrants[seeds[i * 2] - 1] ?? null;
    m.away = entrants[seeds[i * 2 + 1] - 1] ?? null;
  });
}

/**
 * Single elimination for any number of tribus, given in seed order. Missing places
 * become byes. With `thirdPlace`, the semifinal losers play for bronze.
 */
export function singleElimination(
  entrants: readonly number[],
  { thirdPlace = false } = {},
): Result<BracketMatch[]> {
  if (entrants.length < 2) return fail('A bracket needs at least 2 tribus.');
  const size = 2 ** Math.ceil(Math.log2(entrants.length));
  const rounds = Math.log2(size);
  const matches: BracketMatch[] = [];

  for (let r = 1; r <= rounds; r++) {
    for (let p = 1; p <= size / 2 ** r; p++) {
      const m = blank(`R${r}-${p}`, 'single', r, p);
      if (r < rounds) m.winnerTo = { key: `R${r + 1}-${half(p)}`, slot: slotFor(p) };
      matches.push(m);
    }
  }

  if (thirdPlace && rounds >= 2) {
    matches.push(blank('P3', 'single', rounds, 2));
    for (const m of matches.filter((m) => m.round === rounds - 1)) {
      m.loserTo = { key: 'P3', slot: slotFor(m.position) };
    }
  }

  fillRoundOne(
    matches.filter((m) => m.round === 1),
    entrants,
    size,
  );
  applyByes(matches);
  return ok(matches);
}

/**
 * Double elimination for 4, 8, 16… tribus in seed order: an upper bracket, a lower bracket
 * fed by upper-bracket losers, and a grand final between the two bracket winners.
 */
export function doubleElimination(entrants: readonly number[]): Result<BracketMatch[]> {
  const n = entrants.length;
  if (n < 4 || !isPowerOfTwo(n)) {
    return fail(
      `Double elimination needs 4, 8 or 16 tribus (this event has ${n}). Use single elimination or round robin instead.`,
    );
  }
  const k = Math.log2(n);
  const matches: BracketMatch[] = [];
  const byKey = new Map<string, BracketMatch>();
  const add = (m: BracketMatch) => {
    matches.push(m);
    byKey.set(m.key, m);
    return m;
  };

  // Upper bracket.
  for (let r = 1; r <= k; r++) {
    for (let p = 1; p <= n / 2 ** r; p++) {
      const m = add(blank(`U${r}-${p}`, 'upper', r, p));
      m.winnerTo =
        r < k ? { key: `U${r + 1}-${half(p)}`, slot: slotFor(p) } : { key: 'GF', slot: 'home' };
    }
  }

  // Lower bracket: odd rounds pair up lower-bracket winners, even rounds take in
  // the losers dropping from the upper bracket.
  const lowerRounds = 2 * (k - 1);
  for (let r = 1; r <= lowerRounds; r++) {
    const count = n / 2 ** (Math.floor((r + 1) / 2) + 1);
    for (let p = 1; p <= count; p++) {
      const m = add(blank(`L${r}-${p}`, 'lower', r, p));
      if (r === lowerRounds) m.winnerTo = { key: 'GF', slot: 'away' };
      else if (r % 2 === 1) m.winnerTo = { key: `L${r + 1}-${p}`, slot: 'home' };
      else m.winnerTo = { key: `L${r + 1}-${half(p)}`, slot: slotFor(p) };
    }
  }

  add(blank('GF', 'final', 1, 1));

  // Upper-bracket losers drop down. Round 1 losers fill lower round 1; losers of upper
  // round r (r ≥ 2) meet lower-bracket survivors in lower round 2(r−1), in reverse order
  // so tribus that just met are kept apart.
  for (const m of matches.filter((m) => m.stage === 'upper')) {
    if (m.round === 1) {
      m.loserTo = { key: `L1-${half(m.position)}`, slot: slotFor(m.position) };
    } else {
      const lowerRound = 2 * (m.round - 1);
      const count = n / 2 ** m.round;
      m.loserTo = { key: `L${lowerRound}-${count - m.position + 1}`, slot: 'away' };
    }
  }

  fillRoundOne(
    matches.filter((m) => m.stage === 'upper' && m.round === 1),
    entrants,
    n,
  );
  return ok(matches);
}

const STAGE_NAMES: Record<BracketStage, string> = {
  single: 'Round',
  upper: 'Upper round',
  lower: 'Lower round',
  final: 'Grand final',
};

export function matchLabel(m: BracketMatch): string {
  if (m.key === 'GF') return STAGE_NAMES.final;
  if (m.key === 'P3') return 'Third-place match';
  return `${STAGE_NAMES[m.stage]} ${m.round}, match ${m.position}`;
}

/** The matches a result feeds into, with the tribu each one should receive. */
function feeds(m: BracketMatch): Array<[Link, number | null]> {
  const loser = m.winner === null ? null : m.winner === m.home ? m.away : m.home;
  const out: Array<[Link, number | null]> = [];
  if (m.winnerTo) out.push([m.winnerTo, m.winner]);
  if (m.loserTo) out.push([m.loserTo, loser]);
  return out;
}

function pushForward(matches: BracketMatch[], m: BracketMatch): Result<BracketMatch[]> {
  const byKey = new Map(matches.map((x) => [x.key, x]));
  for (const [link, tribu] of feeds(m)) {
    const next = byKey.get(link.key);
    if (!next) continue;
    if (next[link.slot] !== tribu && next.status === 'done') {
      return fail(
        `Clear the result of ${matchLabel(next)} first. It already uses the outcome of this match.`,
      );
    }
    next[link.slot] = tribu;
  }
  return ok(matches);
}

/** Records a score, sends the winner (and loser, in double elimination) to their next match. */
export function recordResult(
  bracket: readonly BracketMatch[],
  key: string,
  homeScore: number,
  awayScore: number,
): Result<BracketMatch[]> {
  const matches = structuredClone(bracket) as BracketMatch[];
  const m = matches.find((x) => x.key === key);
  if (!m) return fail('That match is no longer in this bracket.');
  if (m.home === null || m.away === null)
    return fail('Both tribus need to be set before entering a score.');
  if (![homeScore, awayScore].every((s) => Number.isInteger(s) && s >= 0)) {
    return fail('Scores must be whole numbers, 0 or more.');
  }
  if (homeScore === awayScore)
    return fail('A bracket match needs a winner. Enter the tiebreak score.');

  m.homeScore = homeScore;
  m.awayScore = awayScore;
  m.winner = homeScore > awayScore ? m.home : m.away;
  m.status = 'done';
  return pushForward(matches, m);
}

/** Removes a result and takes its tribus back out of the matches it fed. */
export function clearResult(bracket: readonly BracketMatch[], key: string): Result<BracketMatch[]> {
  const matches = structuredClone(bracket) as BracketMatch[];
  const m = matches.find((x) => x.key === key);
  if (!m) return fail('That match is no longer in this bracket.');
  if (m.status !== 'done') return ok(matches);

  m.homeScore = null;
  m.awayScore = null;
  m.winner = null;
  m.status = 'scheduled';
  return pushForward(matches, m);
}
