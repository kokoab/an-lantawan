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
