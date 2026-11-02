import { describe, expect, it } from 'vitest';
import type { Doc } from './doc';
import { readingMinutes, wordCount } from './reading';

const para = (text: string) => ({
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text }],
});

describe('wordCount', () => {
  it('counts words across paragraphs, headings, lists and captions', () => {
    const doc: Doc = {
      type: 'doc',
      content: [
        para('One two three.'),
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Four' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [para('five six')] }] },
        { type: 'image', attrs: { mediaId: null, key: null, alt: '', caption: 'seven' } },
        { type: 'horizontalRule' },
      ],
    };
    expect(wordCount(doc)).toBe(7);
  });

  it('ignores lone punctuation', () => {
    expect(wordCount({ type: 'doc', content: [para('Yes — no – maybe ...')] })).toBe(3);
  });
});

describe('readingMinutes', () => {
  it('rounds to whole minutes and never says zero', () => {
    expect(readingMinutes({ type: 'doc', content: [] })).toBe(1);
    expect(readingMinutes({ type: 'doc', content: [para('word '.repeat(1320))] })).toBe(6);
  });
});
