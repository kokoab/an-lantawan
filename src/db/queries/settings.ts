import { inArray, sql } from 'drizzle-orm';
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

/** Saves settings, recording who changed them. */
export async function saveSettings(db: Db, values: Record<string, unknown>, editorId: number) {
  const [first, ...rest] = Object.entries(values).map(([key, value]) =>
    db
      .insert(settings)
      .values({ key, value, updatedBy: editorId })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedBy: editorId, updatedAt: sql`(unixepoch())` },
      }),
  );
  if (first) await db.batch([first, ...rest]);
}
