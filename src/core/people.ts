/**
 * Two letters for someone's square: their first name and the next capitalised word,
 * skipping middle initials and particles like “dela”. Francis Angelo Batiancela is FA,
 * Juan dela Cruz is JC, Chyska L. Rojas is CR.
 */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0]?.toUpperCase() ?? '?';
  const next = words.slice(1).find((w) => /^\p{Lu}/u.test(w) && !/^\p{Lu}\.?$/u.test(w));
  return next ? `${first}${next[0]}` : first;
}

/** The school year a date falls in. LNU's year starts in August: 2026–2027 runs Aug 2026 to Jul 2027. */
export function schoolYearOf(d: Date) {
  const manila = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = manila.getUTCFullYear();
  return manila.getUTCMonth() >= 7 ? `${y}–${y + 1}` : `${y - 1}–${y}`;
}

/** The new-year checklist shows from June to September, when staff change over. */
export const isYearStart = (d: Date) => {
  const m = new Date(d.getTime() + 8 * 60 * 60 * 1000).getUTCMonth();
  return m >= 5 && m <= 8;
};

/**
 * Where a position sits on the board: the editor-in-chief first, then the associate and
 * managing editors, the other editors, directors, the rest of the staff, and advisers last.
 * Positions are typed freely, so this reads the words rather than an exact list.
 */
export function positionRank(position: string) {
  const p = position.trim().toLowerCase().replace(/[‐-―]/g, '-');
  if (/\badvis[eo]r\b/.test(p)) return 7;
  if (/^editor[- ]in[- ]chief\b/.test(p)) return 1;
  if (/^associate editor\b/.test(p)) return 2;
  if (/^managing editor\b/.test(p)) return 3;
  if (/\beditor\b/.test(p)) return 4;
  if (/\bdirector\b/.test(p)) return 5;
  return 6;
}

/** Sorts people on the board by position rank, then the order editors gave, then name. */
export function boardOrder<T extends { position: string; name: string; sort?: number }>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      positionRank(a.position) - positionRank(b.position) ||
      (a.sort ?? 0) - (b.sort ?? 0) ||
      a.name.localeCompare(b.name),
  );
}
