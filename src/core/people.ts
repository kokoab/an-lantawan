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
