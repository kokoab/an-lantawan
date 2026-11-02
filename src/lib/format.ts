const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'Asia/Manila' });

/** "April 6, 2025", in Philippine time. */
export const formatDate = (d: Date | null) => (d ? dateFormat.format(d) : '');

/** Machine-readable date for <time datetime>. */
export const isoDate = (d: Date | null) => (d ? d.toISOString() : undefined);
