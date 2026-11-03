import { describe, expect, it } from 'vitest';
import { initials, isYearStart, schoolYearOf } from './people';

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
