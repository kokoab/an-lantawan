const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'Asia/Manila' });

/** "April 6, 2025", in Philippine time. */
export const formatDate = (d: Date | null) => (d ? dateFormat.format(d) : '');

/** Machine-readable date for <time datetime>. */
export const isoDate = (d: Date | null) => (d ? d.toISOString() : undefined);

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Manila',
});

/** "September 2025" from a date or a YYYY-MM-DD string. */
export const formatMonth = (d: Date | string) =>
  monthYear.format(typeof d === 'string' ? new Date(`${d}T00:00:00+08:00`) : d);

/** "18 MB", "640 KB". */
export function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const dayMonth = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Manila',
});
const clock = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
});

/** "March 11" from a date or a YYYY-MM-DD string. */
export const formatDayMonth = (d: Date | string) =>
  dayMonth.format(typeof d === 'string' ? new Date(`${d}T00:00:00+08:00`) : d);

/** "3:00 PM", in Philippine time. */
export const formatTime = (d: Date) => clock.format(d);

/** "March 10 to 14", or "March 30 to April 2" across months. */
export function formatDayRange(from: string, to: string) {
  if (from === to) return formatDayMonth(from);
  const [a, b] = [formatDayMonth(from), formatDayMonth(to)];
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return `${a} to ${sameMonth ? b.split(' ')[1] : b}`;
}
