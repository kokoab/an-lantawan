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
