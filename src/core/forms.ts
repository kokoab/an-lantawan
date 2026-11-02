import { z } from 'zod';
import { SLUG } from './slug';

/**
 * Admin form fields as Zod schemas. Forms arrive as strings; these turn them into clean
 * values (trimmed text, numbers, dates in Philippine time) and give each mistake one plain
 * message to show beside its field.
 */

/** Values of a submitted form: one string per field, or a list for repeated fields. */
export type FormValues = Record<string, string | string[]>;

export const text = (max: number, required = 'Fill this in.') =>
  z.string().trim().min(1, required).max(max, `Keep it under ${max} characters.`);

/** Optional text: empty becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .transform((v) => (v === '' ? null : v));

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Add a URL name.')
  .max(80, 'Keep the URL name under 80 characters.')
  .regex(SLUG, 'Use lowercase letters, numbers and dashes only, like basketball-finals.');

/** A checkbox: present means on. */
export const checkbox = z
  .union([z.literal('on'), z.literal('true'), z.literal('1'), z.literal('')])
  .optional()
  .transform((v) => v === 'on' || v === 'true' || v === '1');

export const id = z.coerce.number().int().positive('Choose one.');

/** An optional ID from a select: empty becomes null. */
export const optionalId = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Choose one from the list.' });
      return z.NEVER;
    }
    return n;
  });

export const wholeNumber = (min: number, max: number) =>
  z.coerce
    .number({ message: 'Enter a number.' })
    .int('Use a whole number.')
    .min(min, `Use ${min} or more.`)
    .max(max, `Use ${max} or less.`);

/** A score: a number that may be a half, such as 2.5 in chess. Empty becomes null. */
export const optionalScore = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const n = Number(v.replace('½', '.5'));
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      ctx.addIssue({ code: 'custom', message: 'Enter a score, like 64 or 2.5.' });
      return z.NEVER;
    }
    return n;
  });

export const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Pick a real date.');

export const optionalDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
      ctx.addIssue({ code: 'custom', message: 'Pick a real date.' });
      return z.NEVER;
    }
    return v;
  });

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** A date and time typed in Philippine time (the newsroom's clock). Empty becomes null. */
export const optionalDateTime = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const ms = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? Date.parse(`${v}:00+08:00`) : Number.NaN;
    if (Number.isNaN(ms)) {
      ctx.addIssue({ code: 'custom', message: 'Pick a date and time.' });
      return z.NEVER;
    }
    return new Date(ms);
  });

/** The value a datetime-local input needs to show a moment in Philippine time. */
export const toDateTimeInput = (d: Date | null) =>
  d ? new Date(d.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 16) : '';

export const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #DB2926.')
  .transform((v) => v.toUpperCase());

/** A link to another site (https only), or a path on this one. Empty becomes null. */
export const optionalLink = z
  .string()
  .trim()
  .max(500)
  .transform((v, ctx) => {
    if (v === '') return null;
    if (/^\/(?!\/)[^\s]*$/.test(v) || /^https:\/\/[^\s/]+[^\s]*$/.test(v)) return v;
    ctx.addIssue({
      code: 'custom',
      message: 'Use a path like /about or a link starting with https://',
    });
    return z.NEVER;
  });

/** A path on this site, such as /news/old-story. */
export const path = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/(?!\/)[^\s?#]*$/, 'Use a path that starts with /, like /news/old-story.');

export const email = z.string().trim().toLowerCase().email('Enter an email address.').max(200);

export const oneOf = <const T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.enum(values, { message });

type Parsed<T> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

/**
 * Checks form values against a schema. Fields the schema lists as arrays get every value
 * of a repeated field; others get the first. Missing fields read as empty.
 */
export function parseForm<S extends z.ZodObject>(
  schema: S,
  values: FormValues,
): Parsed<z.output<S>> {
  const input: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(schema.shape)) {
    const v = values[name];
    const wantsList = field instanceof z.ZodArray;
    if (wantsList) input[name] = v === undefined ? [] : Array.isArray(v) ? v : [v];
    else input[name] = v === undefined ? undefined : Array.isArray(v) ? v[0] : v;
    if (input[name] === undefined && !(field instanceof z.ZodOptional)) input[name] = '';
  }
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
