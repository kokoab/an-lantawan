import { describe, expect, it } from 'vitest';
import type { Doc } from './content/doc';
import { canPublish, publishChecks } from './stories-checks';

const body = (text: string): Doc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const ready = {
  title: 'Lakapati holds off Dayea for basketball gold',
  dek: 'A late run decided it.',
  sectionId: 1,
  slug: 'lakapati-basketball-gold',
  body: body('Lakapati trailed by three.'),
  writers: 1,
  cover: { alt: 'The drum line' },
  needsText: true,
};

describe('publishChecks', () => {
  it('passes a finished story', () => {
    const checks = publishChecks(ready);
    expect(canPublish(checks)).toBe(true);
    expect(checks.every((c) => c.level === 'ok')).toBe(true);
  });

  it('blocks a cover photo without a description, and warns about long headlines', () => {
    const checks = publishChecks({ ...ready, title: 'x'.repeat(104), cover: { alt: '' } });
    expect(checks.map((c) => [c.id, c.level])).toEqual([
      ['alt', 'problem'],
      ['long-title', 'warning'],
      ['basics', 'ok'],
      ['link', 'ok'],
    ]);
    expect(checks[1].text).toBe('The headline is 104 characters. Cards cut it at about 90.');
    expect(canPublish(checks)).toBe(false);
  });

  it('needs a headline and text, except for cartoons and photo stories', () => {
    const empty = { ...ready, title: ' ', body: { type: 'doc' as const, content: [] } };
    expect(
      publishChecks(empty)
        .filter((c) => c.level === 'problem')
        .map((c) => c.id),
    ).toEqual(['title', 'body']);
    expect(
      publishChecks({ ...ready, body: { type: 'doc', content: [] }, needsText: false }).some(
        (c) => c.id === 'body',
      ),
    ).toBe(false);
  });

  it('warns when photos in the story lack descriptions or the basics are missing', () => {
    const withPhotos: Doc = {
      type: 'doc',
      content: [
        ...body('Text.').content,
        { type: 'image', attrs: { mediaId: 1, key: 'a.jpg', alt: '', caption: '' } },
        { type: 'image', attrs: { mediaId: 2, key: 'b.jpg', alt: '', caption: '' } },
      ],
    };
    const checks = publishChecks({ ...ready, body: withPhotos, dek: null, writers: 0 });
    expect(checks.find((c) => c.id === 'photo-alt')?.text).toBe(
      '2 photos in the story have no description.',
    );
    expect(checks.find((c) => c.id === 'basics')?.level).toBe('warning');
    expect(canPublish(checks)).toBe(true);
  });
});
