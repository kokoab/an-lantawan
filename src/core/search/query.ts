/** Longest search we accept, and how many words of it we use. */
export const MAX_QUERY_LENGTH = 120;
const MAX_TERMS = 8;

/** The words of a search, lowercased, without punctuation. */
export function searchTerms(input: string): string[] {
  return input
    .slice(0, MAX_QUERY_LENGTH)
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

/**
 * An FTS5 query where every word must appear, each matching as a prefix ("lib" finds
 * "library"). Words are quoted, so nothing the reader types is read as FTS syntax.
 */
export function toFtsQuery(input: string): string | null {
  const terms = searchTerms(input);
  return terms.length ? terms.map((t) => `"${t}"*`).join(' ') : null;
}

/** A shorter search to suggest when a multi-word search finds nothing. */
export function shorterSearch(input: string): string | null {
  const terms = searchTerms(input);
  if (terms.length < 2) return null;
  return [...terms].sort((a, b) => b.length - a.length)[0];
}
