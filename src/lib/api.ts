import type { z } from 'zod';

/** A JSON reply from an admin endpoint. */
export const reply = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status });

/** Reads and checks a JSON body. Bad input gets one plain message per field. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S) {
  const raw = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true as const, data: parsed.data as z.output<S> };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues)
    errors[String(issue.path[0] ?? 'form')] ??= issue.message;
  return { ok: false as const, response: reply({ ok: false, errors }, 422) };
}
