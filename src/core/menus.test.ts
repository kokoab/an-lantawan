import { describe, expect, it } from 'vitest';
import { readMenuRows } from './menus';

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
