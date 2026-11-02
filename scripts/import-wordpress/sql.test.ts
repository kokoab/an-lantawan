import { describe, expect, it } from 'vitest';
import { mediaSql, orphanPeopleSql, sqlText, storySql } from './sql.ts';
import type { PlannedStory } from './transform.ts';

const story: PlannedStory = {
  wpId: 42,
  title: "It’s O'Brien’s day",
  slug: 'its-obriens-day',
  section: 'opinion',
  kind: 'opinion',
  tags: [],
  publishedAt: new Date('2025-01-02T03:04:05Z'),
  doc: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: "Don't" }] }],
  },
  images: [],
  cover: null,
  credits: [],
  needsReview: false,
  url: 'https://anlantawan.wordpress.com/x',
};

describe('sqlText', () => {
  it('escapes single quotes and writes NULL for missing values', () => {
    expect(sqlText("O'Brien")).toBe("'O''Brien'");
    expect(sqlText(null)).toBe('NULL');
  });
});

describe('storySql', () => {
  const sql = storySql(story, {
    coverKey: 'wp/42/a.jpg',
    bodyKeys: ['wp/42/a.jpg', 'wp/42/b.jpg'],
    authors: [{ personSlug: 'juan-dela-cruz', role: 'writer' }],
    tagSlugs: ['special-publication'],
  });

  it('upserts on the WordPress ID so a re-run updates instead of duplicating', () => {
    expect(sql[0]).toContain('ON CONFLICT(wp_id) DO UPDATE');
    expect(sql[0]).toContain("'It’s O''Brien’s day'");
    expect(sql[0]).toContain(
      `'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Don''t"}]}]}'`,
    );
  });

  it('replaces bylines, tags and file links instead of adding to them', () => {
    expect(sql.slice(1, 4).every((s) => s.startsWith('DELETE FROM'))).toBe(true);
    expect(sql.filter((s) => s.includes('story_authors (')).length).toBe(1);
  });

  it('links each file once', () => {
    expect(sql.filter((s) => s.includes('story_media (')).length).toBe(2);
  });

  it('puts an opinion piece’s picture on top', () => {
    expect(sql[0]).toMatch(/\(SELECT id FROM media WHERE key = 'wp\/42\/a\.jpg'\), 1,/);
  });

  it('stores times in seconds', () => {
    expect(sql[0]).toContain(String(Date.UTC(2025, 0, 2, 3, 4, 5) / 1000));
  });
});

describe('mediaSql', () => {
  it('keeps the first alt text and caption but refreshes file details', () => {
    const s = mediaSql({
      key: 'k',
      mime: 'image/jpeg',
      bytes: 10,
      width: 4,
      height: 3,
      alt: '',
      caption: 'Hi',
    });
    expect(s).toContain("NULL, 'Hi'");
    expect(s).toContain('ON CONFLICT(key) DO UPDATE SET mime');
  });
});

describe('orphanPeopleSql', () => {
  it('only removes people nobody credits', () => {
    const [s] = orphanPeopleSql(['darlin-margate']);
    expect(s).toContain("slug = 'darlin-margate'");
    expect(s).toContain('NOT IN (SELECT person_id FROM story_authors)');
  });
});
