import { describe, expect, it } from 'vitest';
import { checkIdToken, normalizeEmail, safeNextPath } from './google';
import { generateToken, hashToken, newExpiry, sessionState } from './session';

const now = new Date('2026-11-02T00:00:00Z');
const valid = {
  iss: 'https://accounts.google.com',
  aud: 'client-1',
  exp: now.getTime() / 1000 + 300,
  email: 'AnLantawan@LNU.edu.ph',
  email_verified: true,
  name: 'An Lantawan',
};

describe('checkIdToken', () => {
  it('accepts a valid token and lowercases the email', () => {
    expect(checkIdToken(valid, 'client-1', now)).toEqual({
      ok: true,
      email: 'anlantawan@lnu.edu.ph',
      name: 'An Lantawan',
    });
  });

  it.each([
    ['issuer', { iss: 'https://evil.example' }],
    ['audience', { aud: 'someone-elses-app' }],
    ['expired', { exp: now.getTime() / 1000 - 1 }],
    ['unverified', { email_verified: false }],
    ['unverified', { email: undefined }],
  ])('rejects a bad %s', (reason, change) => {
    expect(checkIdToken({ ...valid, ...change }, 'client-1', now)).toEqual({ ok: false, reason });
  });

  it('rejects nothing at all', () => {
    expect(checkIdToken(null, 'client-1', now).ok).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Batiancela@Gmail.com ')).toBe('batiancela@gmail.com');
  });
});

describe('safeNextPath', () => {
  it.each([
    ['/admin/stories?page=2', '/admin/stories?page=2'],
    [null, '/admin'],
    ['https://evil.example/admin', '/admin'],
    ['//evil.example/admin', '/admin'],
    ['/admin\\@evil.example', '/admin'],
    ['/sumat', '/admin'],
    ['/admin/../sumat', '/admin'],
    ['/administrator', '/admin'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe('sessions', () => {
  it('makes long, unique, URL-safe tokens', () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });

  it('stores a hash, not the token', async () => {
    const token = generateToken();
    const hash = await hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(await hashToken(token)).toBe(hash);
  });

  it('expires, refreshes when half used, and is valid otherwise', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(sessionState(newExpiry(now), now)).toBe('valid');
    expect(sessionState(new Date(now.getTime() + 10 * day), now)).toBe('refresh');
    expect(sessionState(now, now)).toBe('expired');
  });
});

describe('short sessions without “Remember me”', () => {
  const now = new Date('2026-03-12T00:00:00Z');
  it('last 12 hours and slide forward once half is used', () => {
    expect(newExpiry(now, false).toISOString()).toBe('2026-03-12T12:00:00.000Z');
    expect(sessionState(new Date('2026-03-12T11:00:00Z'), now, false)).toBe('valid');
    expect(sessionState(new Date('2026-03-12T05:00:00Z'), now, false)).toBe('refresh');
    expect(sessionState(new Date('2026-03-11T23:59:00Z'), now, false)).toBe('expired');
  });
});
