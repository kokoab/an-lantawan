import { z } from 'zod';

/** Error codes the Sumat page knows how to explain. */
export type SubmissionError =
  | 'closed'
  | 'empty'
  | 'name_required'
  | 'too_fast'
  | 'busy'
  | 'verification';

export const MIN_MS_ON_PAGE = 3000;
export const MAX_PER_MINUTE = 60;
export const NAME_MAX = 80;

const raw = z.object({
  message: z.string().default(''),
  identity: z.enum(['anonymous', 'named']).catch('anonymous'),
  name: z.string().default(''),
  course: z.string().default(''),
  website: z.string().default(''),
  elapsedMs: z.coerce.number().catch(0),
  turnstileToken: z.string().default(''),
});

export interface CleanSubmission {
  body: string;
  sentAs: 'anonymous' | 'named';
  name: string | null;
  courseYear: string | null;
}

export type Checked =
  | { kind: 'save'; value: CleanSubmission; turnstileToken: string }
  /** Honeypot filled in: answer as if it worked, store nothing. */
  | { kind: 'discard' }
  | { kind: 'reject'; error: SubmissionError };

/** Strips control characters and trims to a maximum length. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: removing control characters is the point.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const clean = (value: string, max: number) =>
  value.replace(CONTROL_CHARS, '').trim().slice(0, max);

export function checkSubmission(input: unknown, maxLength: number): Checked {
  const parsed = raw.safeParse(input ?? {});
  if (!parsed.success) return { kind: 'reject', error: 'empty' };
  const data = parsed.data;

  if (data.website) return { kind: 'discard' };
  if (data.elapsedMs < MIN_MS_ON_PAGE) return { kind: 'reject', error: 'too_fast' };

  const body = clean(data.message, maxLength);
  if (body.length < 2) return { kind: 'reject', error: 'empty' };

  const named = data.identity === 'named';
  const name = named ? clean(data.name, NAME_MAX) : '';
  if (named && !name) return { kind: 'reject', error: 'name_required' };
  const course = named ? clean(data.course, NAME_MAX) : '';

  return {
    kind: 'save',
    value: { body, sentAs: data.identity, name: name || null, courseYear: course || null },
    turnstileToken: data.turnstileToken,
  };
}
