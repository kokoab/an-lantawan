import { describe, expect, it } from 'vitest';
import { initials } from './people';

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
