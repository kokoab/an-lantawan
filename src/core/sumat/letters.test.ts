import { describe, expect, it } from 'vitest';
import { defaultSignature, letterSlug } from './letters';

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
