import { describe, expect, it } from 'vitest';
import { describeChange, wordDiff } from './diff';
import type { Doc } from './doc';

const doc = (...paras: string[]): Doc => ({
  type: 'doc',
  content: paras.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

describe('wordDiff', () => {
  it('marks removed and added words', () => {
    expect(wordDiff('Lakapati edges Dayea', 'Lakapati holds off Dayea')).toEqual([
      { op: 'same', text: 'Lakapati ' },
      { op: 'removed', text: 'edges ' },
      { op: 'added', text: 'holds off ' },
      { op: 'same', text: 'Dayea' },
    ]);
  });

  it('handles empty texts', () => {
    expect(wordDiff('', 'New')).toEqual([{ op: 'added', text: 'New' }]);
    expect(wordDiff('Old', '')).toEqual([{ op: 'removed', text: 'Old' }]);
    expect(wordDiff('', '')).toEqual([]);
  });
});

describe('describeChange', () => {
  const base = { title: 'A', dek: 'S', body: doc('One.', 'Two.') };
  it('names what changed', () => {
    expect(describeChange(null, base)).toBe('Started the draft');
    expect(describeChange(base, { ...base, title: 'B', body: doc('One!', 'Two.') })).toBe(
      'Changed the headline and first paragraph',
    );
    expect(describeChange(base, { ...base, dek: 'T' })).toBe('Changed the summary');
    expect(describeChange(base, { ...base, body: doc('1', '2') })).toBe('Changed 2 paragraphs');
    expect(describeChange(base, base)).toBe('Saved without changes');
  });

  it('notices added photos', () => {
    const withPhoto: Doc = {
      type: 'doc',
      content: [
        ...doc('One.', 'Two.').content,
        { type: 'image', attrs: { mediaId: 1, key: 'k', alt: '', caption: 'C' } },
      ],
    };
    expect(describeChange(base, { ...base, body: withPhoto })).toBe('Added a photo');
  });
});
