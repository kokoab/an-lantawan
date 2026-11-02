/** Titles, sections and story kinds for imported WordPress posts. */
import { decodeHTML } from 'entities';

export type SectionSlug = 'news' | 'opinion' | 'features' | 'sports' | 'sci-tech';
export type Kind = 'article' | 'opinion' | 'editorial' | 'explainer' | 'video';

const EXPLAINER_PREFIX = /^\s*(?:AL\s+EXPLAINER\s*:|\[\s*EXPLAINER\s*\])\s*/i;

/**
 * Decodes entities and folds styled Unicode (𝗚𝗼𝗹𝗱𝗲𝗻 → Golden) back to plain letters.
 * Returns the clean title and whether it carried an explainer prefix.
 */
export function cleanTitle(raw: string): { title: string; explainer: boolean } {
  const decoded = decodeHTML(raw).normalize('NFKC').replace(/\s+/g, ' ').trim();
  const explainer = EXPLAINER_PREFIX.test(decoded);
  return { title: decoded.replace(EXPLAINER_PREFIX, '').trim(), explainer };
}

// Checked in order: a post in NEWS and SPORTS belongs in Sports.
const SECTION_RULES: Array<[SectionSlug, string[]]> = [
  ['sci-tech', ['SCIE-TECH']],
  ['sports', ['SPORTS']],
  ['opinion', ['OPINION', 'EDITORIAL', 'COLUMN', 'COMMENTARIES']],
  ['features', ['FEATURE ARTICLES', 'LITERARY', 'TIPS']],
  ['news', ['NEWS', 'ANNOUNCEMENT', 'EXPLAINER', 'VIDEOS']],
];

export interface Classified {
  section: SectionSlug;
  kind: Kind;
  tags: string[];
  /** True when the post had no category that says where it belongs. */
  needsReview: boolean;
}

export function classify(categories: string[], explainerTitle: boolean): Classified {
  const cats = new Set(categories.map((c) => c.trim().toUpperCase()));
  const match = SECTION_RULES.find(([, names]) => names.some((n) => cats.has(n)));
  const section = match?.[0] ?? 'news';

  let kind: Kind = 'article';
  if (explainerTitle || cats.has('EXPLAINER')) kind = 'explainer';
  else if (cats.has('EDITORIAL')) kind = 'editorial';
  else if (section === 'opinion') kind = 'opinion';
  else if (cats.has('VIDEOS')) kind = 'video';

  const tags = cats.has('SPECIAL PUBLICATION') ? ['Special publication'] : [];
  return { section, kind, tags, needsReview: !match };
}

/** A URL-safe slug: lowercase ASCII letters, digits and dashes. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}
