import { inArray } from 'drizzle-orm';
import type { Db } from '../client';
import { settings } from '../schema';

/** Reads several settings at once, falling back to the given defaults. */
export async function getSettings<T extends Record<string, unknown>>(
  db: Db,
  defaults: T,
): Promise<T> {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, Object.keys(defaults)));
  const found = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...defaults, ...found } as T;
}
