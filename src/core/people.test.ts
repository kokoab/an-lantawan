import { describe, expect, it } from 'vitest';
import { boardOrder, initials, isYearStart, positionRank, schoolYearOf } from './people';

describe('initials', () => {
  it('matches the admin frames', () => {
    expect(initials('Francis Angelo Batiancela')).toBe('FA');
    expect(initials('Mark Villanueva')).toBe('MV');
    expect(initials('Juan dela Cruz')).toBe('JC');
    expect(initials('Chyska L. Rojas')).toBe('CR');
  });

  it('copes with one word and empty names', () => {
    expect(initials('Photo')).toBe('P');
    expect(initials('  ')).toBe('?');
    expect(initials('Ñino Álvarez')).toBe('ÑÁ');
  });
});

describe('school years', () => {
  it('turn over in August, by the Philippine calendar', () => {
    expect(schoolYearOf(new Date('2026-07-31T15:00:00Z'))).toBe('2025–2026');
    expect(schoolYearOf(new Date('2026-07-31T16:30:00Z'))).toBe('2026–2027');
    expect(schoolYearOf(new Date('2027-03-12T00:00:00Z'))).toBe('2026–2027');
  });

  it('show the new-year checklist from June to September', () => {
    expect(isYearStart(new Date('2026-06-01T00:00:00Z'))).toBe(true);
    expect(isYearStart(new Date('2026-09-30T00:00:00Z'))).toBe(true);
    expect(isYearStart(new Date('2026-11-03T00:00:00Z'))).toBe(false);
    expect(isYearStart(new Date('2027-03-12T00:00:00Z'))).toBe(false);
  });
});

describe('positionRank', () => {
  it('puts the top editors in their usual order', () => {
    expect(positionRank('Editor-in-chief')).toBe(1);
    expect(positionRank('Editor in Chief')).toBe(1);
    expect(positionRank('Editor–in–chief')).toBe(1);
    expect(positionRank('Associate editor')).toBe(2);
    expect(positionRank('Managing Editor')).toBe(3);
  });

  it('groups other editors, then directors, then staff', () => {
    expect(positionRank('News editor')).toBe(4);
    expect(positionRank('Creatives and Multimedia Director')).toBe(5);
    expect(positionRank('Sports writer')).toBe(6);
    expect(positionRank('Columnist, Margins')).toBe(6);
  });

  it('always lists advisers last, even ones with “editor” in the title', () => {
    expect(positionRank('Adviser')).toBe(7);
    expect(positionRank('Technical adviser')).toBe(7);
    expect(positionRank('Editorial advisor')).toBe(7);
  });
});

describe('boardOrder', () => {
  it('orders by rank, then the given order, then name', () => {
    const rows = [
      { name: 'Ana', position: 'Adviser' },
      { name: 'Mark', position: 'Sports writer' },
      { name: 'Juan', position: 'Columnist' },
      { name: 'Lea', position: 'Editor-in-chief' },
      { name: 'Bea', position: 'News editor', sort: 2 },
      { name: 'Cy', position: 'Features editor', sort: 1 },
    ];
    expect(boardOrder(rows).map((r) => r.name)).toEqual([
      'Lea',
      'Cy',
      'Bea',
      'Juan',
      'Mark',
      'Ana',
    ]);
  });

  it('leaves the input alone', () => {
    const rows = [
      { name: 'B', position: 'Adviser' },
      { name: 'A', position: 'Editor-in-chief' },
    ];
    boardOrder(rows);
    expect(rows[0].name).toBe('B');
  });
});
