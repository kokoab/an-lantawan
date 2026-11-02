/**
 * Builds the SQL that loads a planned import into D1. Every statement can be run again:
 * stories are matched on their WordPress ID, people, tags and files on their slug or key.
 */
import type { PlannedStory } from './transform.ts';

export interface StoredImage {
  key: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
}

export const sqlText = (v: string | null | undefined) =>
  v === null || v === undefined ? 'NULL' : `'${v.replace(/'/g, "''")}'`;
const sqlNum = (v: number | null | undefined) =>
  v === null || v === undefined ? 'NULL' : String(Math.trunc(v));
const seconds = (d: Date) => Math.floor(d.getTime() / 1000);

export function mediaSql(m: StoredImage): string {
  return `INSERT INTO media (key, kind, mime, bytes, width, height, alt, caption) VALUES (${sqlText(m.key)}, 'image', ${sqlText(m.mime)}, ${sqlNum(m.bytes)}, ${sqlNum(m.width)}, ${sqlNum(m.height)}, ${sqlText(m.alt || null)}, ${sqlText(m.caption || null)}) ON CONFLICT(key) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes, width = excluded.width, height = excluded.height;`;
}

export function personSql(name: string, slug: string): string {
  return `INSERT INTO people (name, slug) VALUES (${sqlText(name)}, ${sqlText(slug)}) ON CONFLICT(slug) DO NOTHING;`;
}

export function tagSql(name: string, slug: string): string {
  return `INSERT INTO tags (name, slug) VALUES (${sqlText(name)}, ${sqlText(slug)}) ON CONFLICT(slug) DO NOTHING;`;
}

const storyId = (wpId: number) => `(SELECT id FROM stories WHERE wp_id = ${wpId})`;

export interface StoryLinks {
  coverKey: string | null;
  bodyKeys: string[];
  /** Bylines in order, already resolved to people slugs. */
  authors: Array<{ personSlug: string; role: 'writer' | 'photographer' | 'artist' }>;
  tagSlugs: string[];
}

export function storySql(s: PlannedStory, links: StoryLinks): string[] {
  const at = seconds(s.publishedAt);
  const cover = links.coverKey
    ? `(SELECT id FROM media WHERE key = ${sqlText(links.coverKey)})`
    : 'NULL';
  // Opinion pieces brought over with a picture keep it on top, as the cartoon slot.
  const cartoonOnTop = s.section === 'opinion' && links.coverKey ? 1 : 0;
  const id = storyId(s.wpId);
  const out = [
    `INSERT INTO stories (section_id, kind, status, title, slug, body, cover_id, cartoon_on_top, published_at, updated_at, created_at, wp_id) VALUES ((SELECT id FROM sections WHERE slug = ${sqlText(s.section)}), ${sqlText(s.kind)}, 'published', ${sqlText(s.title)}, ${sqlText(s.slug)}, ${sqlText(JSON.stringify(s.doc))}, ${cover}, ${cartoonOnTop}, ${at}, ${at}, ${at}, ${s.wpId}) ON CONFLICT(wp_id) DO UPDATE SET section_id = excluded.section_id, kind = excluded.kind, title = excluded.title, body = excluded.body, cover_id = excluded.cover_id, cartoon_on_top = excluded.cartoon_on_top, published_at = excluded.published_at;`,
    `DELETE FROM story_authors WHERE story_id = ${id};`,
    `DELETE FROM story_tags WHERE story_id = ${id};`,
    `DELETE FROM story_media WHERE story_id = ${id};`,
  ];
  links.authors.forEach((a, i) => {
    out.push(
      `INSERT OR IGNORE INTO story_authors (story_id, person_id, role, sort) SELECT ${id}, id, ${sqlText(a.role)}, ${i} FROM people WHERE slug = ${sqlText(a.personSlug)};`,
    );
  });
  for (const t of links.tagSlugs) {
    out.push(
      `INSERT OR IGNORE INTO story_tags (story_id, tag_id) SELECT ${id}, id FROM tags WHERE slug = ${sqlText(t)};`,
    );
  }
  for (const key of new Set([...(links.coverKey ? [links.coverKey] : []), ...links.bodyKeys])) {
    out.push(
      `INSERT OR IGNORE INTO story_media (story_id, media_id) SELECT ${id}, id FROM media WHERE key = ${sqlText(key)};`,
    );
  }
  return out;
}

/**
 * Removes people an earlier run created under a spelling that has since been merged into
 * someone else, as long as nothing still credits them.
 */
export function orphanPeopleSql(slugs: string[]): string[] {
  return slugs.map(
    (slug) =>
      `DELETE FROM people WHERE slug = ${sqlText(slug)} AND id NOT IN (SELECT person_id FROM story_authors) AND id NOT IN (SELECT person_id FROM staff_terms);`,
  );
}
