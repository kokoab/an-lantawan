import { describe, expect, it } from 'vitest';
import {
  defaultSignature,
  letterSlug,
  likeness,
  possibleDuplicates,
  relatedStoryBody,
  relatedStoryHref,
  signatureChoices,
} from './letters';

describe('defaultSignature', () => {
  it('never names an anonymous sender, even if a name slipped in', () => {
    expect(defaultSignature('anonymous', 'Juan', 'BSEd 2')).toBe('Anonymous');
  });

  it('signs with the name and course given', () => {
    expect(defaultSignature('named', ' Juan Dela Cruz ', 'BSEd, 2nd year')).toBe(
      'Juan Dela Cruz, BSEd, 2nd year',
    );
    expect(defaultSignature('named', 'Juan', null)).toBe('Juan');
    expect(defaultSignature('named', '', '')).toBe('Anonymous');
  });
});

describe('letterSlug', () => {
  it('is unique per message', () => {
    expect(letterSlug(42)).toBe('letter-42');
  });
});

describe('possibleDuplicates', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 2, 12, h));
  it('flags a near copy sent the same day, pointing at the earlier letter', () => {
    const found = possibleDuplicates([
      {
        id: 1,
        body: 'The covered walk near the CAS building floods every time it rains.',
        receivedAt: at(0),
      },
      {
        id: 2,
        body: 'The covered walk near the CAS building floods every time it rains!!',
        receivedAt: at(1),
      },
      { id: 3, body: 'Can the registrar post enrollment schedules earlier?', receivedAt: at(2) },
    ]);
    expect([...found.entries()]).toEqual([[2, { id: 1, receivedAt: at(0) }]]);
  });

  it('ignores letters a day apart and different letters', () => {
    const found = possibleDuplicates([
      { id: 1, body: 'Open the library later.', receivedAt: new Date('2026-03-10T00:00:00Z') },
      { id: 2, body: 'Open the library later.', receivedAt: new Date('2026-03-12T00:00:00Z') },
    ]);
    expect(found.size).toBe(0);
    expect(likeness('apples and pears', 'trains and boats')).toBeLessThan(0.3);
  });
});

describe('signatureChoices', () => {
  it('keeps anonymous letters anonymous', () => {
    expect(signatureChoices('anonymous', 'Juan', 'second year')).toEqual([
      'Anonymous, second year',
      'Anonymous',
    ]);
  });
  it('offers signed letters their name, or anonymity', () => {
    expect(signatureChoices('named', 'Ana Reyes', 'BEEd 3')).toEqual([
      'Ana Reyes, BEEd 3',
      'Ana Reyes',
      'Anonymous, BEEd 3',
      'Anonymous',
    ]);
  });
});

describe('relatedStoryHref', () => {
  it('reads back the story a letter was linked to', () => {
    expect(relatedStoryHref(relatedStoryBody('/news/library-hours'))).toBe('/news/library-hours');
  });

  it('finds nothing in an empty or missing body', () => {
    expect(relatedStoryHref(null)).toBeNull();
    expect(relatedStoryHref({ type: 'doc', content: [] })).toBeNull();
    expect(relatedStoryHref({ type: 'doc', content: [{ type: 'paragraph' }] })).toBeNull();
  });

  it('ignores links that leave the site', () => {
    expect(relatedStoryHref(relatedStoryBody('https://example.com/x'))).toBeNull();
    expect(relatedStoryHref(relatedStoryBody('//example.com/x'))).toBeNull();
  });

  it('skips plain text and other blocks to find the link', () => {
    expect(
      relatedStoryHref({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'See ' },
              {
                type: 'text',
                text: 'this',
                marks: [{ type: 'bold' }, { type: 'link', attrs: { href: '/a/b' } }],
              },
            ],
          },
        ],
      }),
    ).toBe('/a/b');
  });
});
