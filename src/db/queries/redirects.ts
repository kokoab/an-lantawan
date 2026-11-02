import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { redirects } from '../schema';

/** Where an old address now lives, if it was renamed or moved. */
export async function findRedirect(db: Db, path: string) {
  const [row] = await db
    .select({ to: redirects.toPath })
    .from(redirects)
    .where(eq(redirects.fromPath, path))
    .limit(1);
  return row?.to ?? null;
}
