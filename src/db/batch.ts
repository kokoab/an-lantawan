import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from './client';

export type Query = BatchItem<'sqlite'>;

/** Runs writes together in one D1 batch, so they all apply or none do. */
export async function runBatch(db: Db, queries: Query[]) {
  if (queries.length === 0) return;
  await db.batch(queries as [Query, ...Query[]]);
}
