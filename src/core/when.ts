/** How the admin writes a moment: “Today, 2:41 PM”, “Yesterday, 6:10 PM”, “March 13, 8:00 AM”. */

const TZ = 'Asia/Manila';
const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const time = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const monthDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'long', day: 'numeric' });
const monthDayYear = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const weekday = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

const days = (d: Date) => Math.round(Date.parse(`${dayKey.format(d)}T00:00:00Z`) / 86_400_000);

/**
 * `olderAsDate` drops the time from anything before yesterday and always shows its year,
 * as story lists do: “March 11, 2026”.
 */
export function formatWhen(
  d: Date | null,
  now: Date,
  { withTime = true, olderAsDate = false } = {},
) {
  if (!d) return '';
  const diff = days(d) - days(now);
  if (olderAsDate && diff < -1) return monthDayYear.format(d);
  const t = withTime ? `, ${time.format(d)}` : '';
  if (diff === 0) return withTime ? `Today, ${time.format(d)}` : 'Today';
  if (diff === -1) return `Yesterday${t}`;
  if (diff === 1) return `Tomorrow${t}`;
  const sameYear = dayKey.format(d).slice(0, 4) === dayKey.format(now).slice(0, 4);
  return `${(sameYear ? monthDay : monthDayYear).format(d)}${t}`;
}

/** The time alone, as in “Draft, saved at 2:41 PM”. */
export const formatClock = (d: Date) => time.format(d);

/** “Thursday, March 12”, under the Overview title. */
export const formatToday = (d: Date) => weekday.format(d);
