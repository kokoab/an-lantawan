import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  checkbox,
  hexColor,
  optionalDateTime,
  optionalId,
  optionalLink,
  optionalScore,
  optionalText,
  parseForm,
  path,
  slug,
  text,
  toDateTimeInput,
} from './forms';

describe('parseForm', () => {
  const schema = z.object({
    title: text(10),
    note: optionalText(20),
    featured: checkbox,
    tags: z.array(z.string()),
  });

  it('cleans values and treats missing checkboxes as off', () => {
    expect(parseForm(schema, { title: '  Hi ', note: '', tags: ['a', 'b'] })).toEqual({
      ok: true,
      data: { title: 'Hi', note: null, featured: false, tags: ['a', 'b'] },
    });
  });

  it('wraps a single value of a list field and reads missing fields as empty', () => {
    const r = parseForm(schema, { title: 'Hi', featured: 'on', tags: 'only' });
    expect(r).toMatchObject({ ok: true, data: { featured: true, tags: ['only'], note: null } });
  });

  it('gives one message per field', () => {
    const r = parseForm(schema, { title: '', note: 'x'.repeat(30) });
    expect(r).toEqual({
      ok: false,
      errors: { title: 'Fill this in.', note: 'Keep it under 20 characters.' },
    });
  });
});

describe('fields', () => {
  it('accepts clean slugs only', () => {
    expect(slug.safeParse('Basketball-Finals').data).toBe('basketball-finals');
    for (const bad of ['', 'two words', 'trailing-', '--x', 'ñ', 'a/b']) {
      expect(slug.safeParse(bad).success).toBe(false);
    }
  });

  it('reads optional IDs', () => {
    expect(optionalId.parse('')).toBeNull();
    expect(optionalId.parse('12')).toBe(12);
    expect(optionalId.safeParse('0').success).toBe(false);
    expect(optionalId.safeParse('1.5').success).toBe(false);
  });

  it('reads scores with halves', () => {
    expect(optionalScore.parse('2.5')).toBe(2.5);
    expect(optionalScore.parse('2½')).toBe(2.5);
    expect(optionalScore.parse('')).toBeNull();
    expect(optionalScore.safeParse('-1').success).toBe(false);
    expect(optionalScore.safeParse('lots').success).toBe(false);
  });

  it('reads date and time in Philippine time and writes it back the same', () => {
    const d = optionalDateTime.parse('2026-03-10T07:30');
    expect(d?.toISOString()).toBe('2026-03-09T23:30:00.000Z');
    expect(toDateTimeInput(d)).toBe('2026-03-10T07:30');
    expect(optionalDateTime.parse('')).toBeNull();
    expect(optionalDateTime.safeParse('March 10').success).toBe(false);
  });

  it('only takes six-digit colours', () => {
    expect(hexColor.parse('#db2926')).toBe('#DB2926');
    for (const bad of ['red', '#FFF', 'url(x)', '#12345G']) {
      expect(hexColor.safeParse(bad).success).toBe(false);
    }
  });

  it('takes site paths and https links but not scripts or other schemes', () => {
    expect(optionalLink.parse('/about')).toBe('/about');
    expect(optionalLink.parse('https://facebook.com/x')).toBe('https://facebook.com/x');
    expect(optionalLink.parse('')).toBeNull();
    for (const bad of ['javascript:alert(1)', '//evil.com', 'http://x.com', 'about', 'https://']) {
      expect(optionalLink.safeParse(bad).success).toBe(false);
    }
  });

  it('only takes paths for redirects', () => {
    expect(path.parse('/2016/08/old-post')).toBe('/2016/08/old-post');
    for (const bad of ['old', '//evil.com/x', '/a b', '/x?y=1']) {
      expect(path.safeParse(bad).success).toBe(false);
    }
  });
});
