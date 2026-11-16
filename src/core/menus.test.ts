import { describe, expect, it } from 'vitest';
import { readMenuRows, withoutClosedSumat } from './menus';

describe('readMenuRows', () => {
  it('reads section links and path links in order, dropping blank rows', () => {
    expect(readMenuRows(['News', '', 'About'], ['1', '', ''], ['', '', '/about'], 7)).toEqual({
      ok: true,
      rows: [
        { label: 'News', sectionId: 1, href: null },
        { label: 'About', sectionId: null, href: '/about' },
      ],
    });
  });

  it('prefers the section when both are filled', () => {
    const r = readMenuRows(['News'], ['1'], ['/elsewhere'], 7);
    expect(r).toEqual({ ok: true, rows: [{ label: 'News', sectionId: 1, href: null }] });
  });

  it('names the row that needs fixing', () => {
    expect(readMenuRows(['News', 'X'], ['1', ''], ['', ''], 7)).toEqual({
      ok: false,
      error: 'Link 2: choose a section or type where it goes.',
    });
    expect(readMenuRows([''], [''], ['/about'], 7)).toEqual({
      ok: false,
      error: 'Link 1: give it a label.',
    });
    expect(readMenuRows(['Bad'], [''], ['javascript:alert(1)'], 7).ok).toBe(false);
  });

  it('caps the number of links', () => {
    const many = Array.from({ length: 4 }, (_, i) => `L${i}`);
    expect(readMenuRows(many, ['1', '1', '1', '1'], [], 3)).toEqual({
      ok: false,
      error: 'Keep this menu to 3 links.',
    });
  });
});

describe('withoutClosedSumat', () => {
  const links = [
    { label: 'Write to Sumat', href: '/sumat' },
    { label: 'Published letters', href: '/letters' },
    { label: 'About', href: '/about' },
    { label: 'Sumat again', href: '/sumat/?from=menu#top' },
    { label: 'Not Sumat', href: '/sumatra' },
  ];
  const labels = (l: { label: string }[]) => l.map((x) => x.label);

  it('keeps every link while Sumat is open', () => {
    expect(withoutClosedSumat(links, { sumatOpen: true, hasLetters: false })).toEqual(links);
  });

  it('drops Sumat links, however they are written, when it is closed', () => {
    expect(labels(withoutClosedSumat(links, { sumatOpen: false, hasLetters: true }))).toEqual([
      'Published letters',
      'About',
      'Not Sumat',
    ]);
  });

  it('drops Published letters too when it is closed and empty', () => {
    expect(labels(withoutClosedSumat(links, { sumatOpen: false, hasLetters: false }))).toEqual([
      'About',
      'Not Sumat',
    ]);
  });
});
