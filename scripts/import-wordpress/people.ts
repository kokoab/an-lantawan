/**
 * Old bylines spell the same person several ways ("Chyska L. Rojas", "Chyska Rojas").
 * This decides which spellings are one person. Safe matches merge automatically;
 * anything less certain is listed for a person to decide in aliases.json.
 */

/** Lowercase, no accents, no middle initials, no "Jr." — the core of a name. */
export function nameKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(?:jr|sr|ii|iii|iv)\b\.?/g, ' ')
    .replace(/\b[a-z]\.\s*/g, ' ')
    .replace(/[^a-z\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (key: string) => key.split(' ');
const firstLast = (key: string) => `${words(key)[0]} ${words(key).at(-1)}`;
/** Every word of the shorter name appears, in order, in the longer one. */
const isSubsetOf = (short: string, long: string) => {
  let i = 0;
  for (const w of words(long)) if (w === words(short)[i]) i++;
  return i === words(short).length;
};

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length][b.length];
}

export interface PeopleResult {
  /** Every spelling seen, mapped to the name the person will be listed under. */
  canonical: Map<string, string>;
  /** Pairs that might be the same person, for review. */
  review: Array<{ a: string; b: string; why: string }>;
}

/**
 * Groups spellings into people. `aliases` (spelling → spelling) is applied first, so a
 * reviewer's decisions always win. The fullest spelling in a group becomes its name.
 */
export function groupPeople(
  counts: Map<string, number>,
  aliases: Record<string, string> = {},
): PeopleResult {
  const resolve = (n: string) => aliases[n] ?? n;
  const spellings = [...counts.keys()];

  // 1. Same name once accents, middle initials and "Jr." are set aside.
  const groups = new Map<string, Set<string>>();
  for (const s of spellings) {
    const key = nameKey(resolve(s));
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)?.add(s);
  }

  // 2. A shorter name inside exactly one longer name with the same first and last word
  //    ("Gio Costuna" in "Gio Marion Costuna"). If it fits two different longer names
  //    ("Darlin Margate": "Darlin Mae" or "Darlin Claire"?), leave it for review.
  const review: PeopleResult['review'] = [];
  const keys = [...groups.keys()].sort((a, b) => words(a).length - words(b).length);
  for (const short of keys) {
    const fits = keys.filter(
      (long) => long !== short && firstLast(long) === firstLast(short) && isSubsetOf(short, long),
    );
    const roots = fits.filter((f) => !fits.some((g) => g !== f && isSubsetOf(g, f)));
    if (roots.length === 1) {
      const target = groups.get(roots[0]);
      for (const s of groups.get(short) ?? []) target?.add(s);
      groups.delete(short);
    } else if (roots.length > 1) {
      review.push({ a: short, b: roots.join(' / '), why: 'could be either' });
    }
  }

  // 3. Near spellings ("Emmerson" and "Emerson") are only suggested, never merged.
  const remaining = [...groups.keys()];
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const [a, b] = [remaining[i], remaining[j]];
      if (words(a).at(-1) === words(b).at(-1) || editDistance(a, b) <= 2) {
        if (editDistance(firstLast(a), firstLast(b)) <= 3)
          review.push({ a, b, why: 'similar spelling' });
      }
    }
  }

  const canonical = new Map<string, string>();
  for (const members of groups.values()) {
    const best = [...members].sort(
      (x, y) =>
        resolve(y).length - resolve(x).length || (counts.get(y) ?? 0) - (counts.get(x) ?? 0),
    )[0];
    for (const m of members) canonical.set(m, resolve(best));
  }
  return { canonical, review };
}
