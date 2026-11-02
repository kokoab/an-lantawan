/** How Sportsfest data reads on the public pages: states, days, round names, filters. */

const HEX = /^#[0-9a-f]{6}$/i;
const FALLBACK_COLOR = '#6B6B68';

/**
 * A tribu's tile colours. White text when it reaches 3:1 (the initial is bold display
 * type); light colours such as yellow take black text and a black stroke instead.
 */
export function tribuTile(color: string) {
  const fill = HEX.test(color) ? color.toUpperCase() : FALLBACK_COLOR;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(fill.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const light = 1.05 / (luminance + 0.05) < 3;
  return { fill, text: light ? '#0A0A0A' : '#FFFFFF', outlined: light };
}

/** First letter of a tribu name, or the number in names like "Tribu 4". */
export function tribuInitial(name: string) {
  const numbered = name.trim().match(/^tribu\s+(\d+)$/i);
  if (numbered) return numbered[1];
  return (name.trim()[0] ?? '?').toUpperCase();
}

export type EventStatus = 'scheduled' | 'ongoing' | 'done' | 'postponed' | 'cancelled';
export type RowState = 'upcoming' | 'ongoing' | 'final' | 'postponed' | 'cancelled';

/** A category is final once it has a gold medal, whatever the event as a whole says. */
export function rowState(eventStatus: EventStatus, hasGold: boolean): RowState {
  if (hasGold || eventStatus === 'done') return 'final';
  if (eventStatus === 'scheduled') return 'upcoming';
  return eventStatus;
}

export const ROW_STATE_LABEL: Record<RowState, string> = {
  upcoming: 'Upcoming',
  ongoing: 'Ongoing',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const manila = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in Tacloban, as YYYY-MM-DD. */
export const manilaDay = (d: Date) => manila.format(d);

const dayIndex = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

/** "Day 3 of 5" while a Sportsfest runs; null before, after, or without dates. */
export function festivalDay(startsOn: string | null, endsOn: string | null, today: string) {
  if (!startsOn || !endsOn) return null;
  const of = dayIndex(endsOn) - dayIndex(startsOn) + 1;
  const day = dayIndex(today) - dayIndex(startsOn) + 1;
  if (of < 1 || day < 1 || day > of) return null;
  return { day, of };
}

export interface ScheduledEvent {
  name: string;
  startsAt: Date | null;
  categories: number;
}

export interface ScheduleDay {
  day: number;
  date: string;
  events: string[];
  medalEvents: number;
}

/**
 * The schedule, one row per day from the first to the last day. Events without a date
 * are left out; event names repeat once per day even with several categories.
 */
export function scheduleDays(
  startsOn: string | null,
  endsOn: string | null,
  events: readonly ScheduledEvent[],
): ScheduleDay[] {
  if (!startsOn || !endsOn) return [];
  const first = dayIndex(startsOn);
  const count = dayIndex(endsOn) - first + 1;
  if (count < 1 || count > 31) return [];
  const days: ScheduleDay[] = Array.from({ length: count }, (_, i) => ({
    day: i + 1,
    date: new Date((first + i) * 86_400_000).toISOString().slice(0, 10),
    events: [],
    medalEvents: 0,
  }));
  for (const e of events) {
    if (!e.startsAt) continue;
    const row = days[dayIndex(manilaDay(e.startsAt)) - first];
    if (!row) continue;
    if (!row.events.includes(e.name)) row.events.push(e.name);
    row.medalEvents += e.categories;
  }
  return days;
}

/** Column titles for a knockout stage: the last round is the final, counting back from it. */
export function roundName(round: number, rounds: number) {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return { title: 'Final', match: 'Final' };
  if (fromEnd === 1) return { title: 'Semifinals', match: 'Semifinal' };
  if (fromEnd === 2) return { title: 'Quarterfinals', match: 'Quarterfinal' };
  return { title: `Round ${round}`, match: `Round ${round} match` };
}

export interface EventRowFilterable {
  event: string;
  category: string;
  state: RowState;
  day: string | null;
  medalists: readonly number[];
}

export interface RowFilter {
  q: string;
  state: RowState | null;
  tribuId: number | null;
  day: string | null;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The All events filters. Every word of the search must appear in the event or category. */
export function filterRows<T extends EventRowFilterable>(rows: readonly T[], f: RowFilter): T[] {
  const words = fold(f.q).split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (f.state && r.state !== f.state) return false;
    if (f.day && r.day !== f.day) return false;
    if (f.tribuId !== null && !r.medalists.includes(f.tribuId)) return false;
    const text = fold(`${r.event} ${r.category}`);
    return words.every((w) => text.includes(w));
  });
}

const ORDINALS = ['th', 'st', 'nd', 'rd'];

/** 1st, 2nd, 3rd, 4th, 11th, 21st. */
export function ordinal(n: number) {
  const v = n % 100;
  return `${n}${ORDINALS[(v - 20) % 10] ?? ORDINALS[v] ?? ORDINALS[0]}`;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** "Four tribus", "12 tribus": small counts read better as words at the start of a sentence. */
export const countWords = (n: number, noun: string) =>
  `${WORDS[n] ?? n} ${noun}${n === 1 ? '' : 's'}`;

export type StageKind = 'single' | 'upper' | 'lower' | 'final' | 'group';
export type EventType = 'bracket' | 'race' | 'judged' | 'mind';

/** The format line on an event page, from how its competition is set up. */
export function formatName(type: EventType, stageKinds: readonly StageKind[]) {
  if (stageKinds.includes('lower')) return 'Double elimination';
  if (stageKinds.includes('group') && stageKinds.some((k) => k !== 'group')) {
    return 'Groups, then knockout';
  }
  if (stageKinds.includes('group')) return 'Round robin';
  if (stageKinds.length) return 'Single elimination';
  return { bracket: 'Knockout', race: 'Timed final', judged: 'Judged', mind: 'Ranked' }[type];
}

/** Scores as people write them: 2½, ½, 12. Other fractions keep one decimal. */
export function formatScore(n: number | null) {
  if (n === null) return '';
  const whole = Math.trunc(n);
  const rest = Math.abs(n - whole);
  if (rest === 0) return String(whole);
  if (Math.abs(rest - 0.5) < 1e-9) return `${whole === 0 ? (n < 0 ? '-' : '') : whole}½`;
  return n.toFixed(1);
}

/** "2 points for a win, 1 for a draw", leaving out a loss when it scores nothing. */
export function pointsRuleText(rule: { win: number; draw: number; loss: number }) {
  const p = (n: number) => `${formatScore(n)} ${n === 1 ? 'point' : 'points'}`;
  const parts = [`${p(rule.win)} for a win`, `${formatScore(rule.draw)} for a draw`];
  if (rule.loss !== 0) parts.push(`${formatScore(rule.loss)} for a loss`);
  return parts.join(', ');
}
