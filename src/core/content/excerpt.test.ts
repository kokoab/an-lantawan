import { describe, expect, it } from 'vitest';
import type { Doc } from './doc';
import { leadExcerpt } from './excerpt';

const doc = (...paragraphs: string[]): Doc => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

describe('leadExcerpt', () => {
  it('prefers the summary', () => {
    expect(
      leadExcerpt(
        '  The library opens later.  ',
        doc('A long first paragraph that should not show up here.'),
      ),
    ).toBe('The library opens later.');
  });

  it('falls back to the first paragraph with real text, skipping short lines', () => {
    expect(
      leadExcerpt(
        null,
        doc(
          'By Juan Dela Cruz',
          'Indoor :',
          'The library will stay open until nine every weekday starting Monday.',
        ),
      ),
    ).toBe('The library will stay open until nine every weekday starting Monday.');
  });

  it('skips lines typed as a list', () => {
    expect(
      leadExcerpt(
        null,
        doc(
          '3. Seek protection under the table, or beside a foundation post.',
          'Safety tips from the Emergency Action Group of LNU Employees and Students.',
        ),
      ),
    ).toBe('Safety tips from the Emergency Action Group of LNU Employees and Students.');
  });

  it('cuts long paragraphs at a word and ends with an ellipsis', () => {
    const long = `${'word '.repeat(80)}end`;
    const r = leadExcerpt(null, doc(long), 100) ?? '';
    expect(r.length).toBeLessThanOrEqual(101);
    expect(r.endsWith('word…')).toBe(true);
  });

  it('gives nothing for a story without text', () => {
    expect(leadExcerpt(null, null)).toBeNull();
    expect(leadExcerpt('', doc('Too short.'))).toBeNull();
  });
});
