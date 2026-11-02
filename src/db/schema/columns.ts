import { type SQL, sql } from 'drizzle-orm';
import { type AnySQLiteColumn, check, integer } from 'drizzle-orm/sqlite-core';

/** Primary key shared by every table. */
export const id = () => integer('id').primaryKey({ autoIncrement: true });

/** Unix time in seconds, defaulting to the moment the row is written. */
export const timestamp = (name: string) =>
  integer(name, { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`);

export const createdAt = () => timestamp('created_at');

/** Set instead of deleting, so bylines, results and links keep working. */
export const archivedAt = () => integer('archived_at', { mode: 'timestamp' });

/** Database-level guard that a text column only holds one of the listed values. */
export const oneOf = (
  name: string,
  column: AnySQLiteColumn,
  values: readonly string[],
): ReturnType<typeof check> =>
  check(name, sql`${column} in ${sql.raw(`(${values.map((v) => `'${v}'`).join(', ')})`)}` as SQL);
