import { describe, expect, it } from 'vitest';
import { checkSubmission } from './submission';

const base = { message: 'Fix the library aircon', identity: 'anonymous', elapsedMs: 10_000 };

describe('checkSubmission', () => {
  it('accepts an anonymous message and drops any name sent with it', () => {
    const r = checkSubmission({ ...base, name: 'Juan' }, 500);
    expect(r).toMatchObject({ kind: 'save', value: { sentAs: 'anonymous', name: null } });
  });

  it('requires a name when sending with a name', () => {
    expect(checkSubmission({ ...base, identity: 'named', name: '  ' }, 500)).toEqual({
      kind: 'reject',
      error: 'name_required',
    });
  });

  it('keeps name and course when sending with a name', () => {
    const r = checkSubmission({ ...base, identity: 'named', name: 'Juan', course: 'BSEd 3' }, 500);
    expect(r).toMatchObject({ value: { name: 'Juan', courseYear: 'BSEd 3' } });
  });

  it('rejects empty and one-character messages', () => {
    expect(checkSubmission({ ...base, message: ' a ' }, 500)).toMatchObject({ error: 'empty' });
    expect(checkSubmission({}, 500)).toMatchObject({ kind: 'reject' });
  });

  it('rejects sends faster than a person could type', () => {
    expect(checkSubmission({ ...base, elapsedMs: 800 }, 500)).toMatchObject({ error: 'too_fast' });
  });

  it('quietly discards bot submissions that fill the hidden field', () => {
    expect(checkSubmission({ ...base, website: 'spam.example' }, 500)).toEqual({ kind: 'discard' });
  });

  it('trims to the maximum length and strips control characters', () => {
    const r = checkSubmission({ ...base, message: `ab\u0007${'c'.repeat(600)}` }, 500);
    if (r.kind !== 'save') throw new Error(r.kind);
    expect(r.value.body).toHaveLength(500);
    expect(r.value.body.startsWith('abc')).toBe(true);
  });

  it('treats an unknown identity as anonymous', () => {
    expect(checkSubmission({ ...base, identity: 'admin' }, 500)).toMatchObject({
      value: { sentAs: 'anonymous' },
    });
  });
});
