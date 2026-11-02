import { asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { runBatch } from '../../batch';
import type { Db } from '../../client';
import { activityLog, editors, redirects, sessions } from '../../schema';

/* Editors */

export async function listEditors(db: Db) {
  return db.select().from(editors).orderBy(asc(editors.archivedAt), asc(editors.name));
}

export async function activeEditorCount(db: Db) {
  const [row] = await db.select({ n: count() }).from(editors).where(isNull(editors.archivedAt));
  return row?.n ?? 0;
}

export async function findEditorByEmail(db: Db, email: string) {
  const [row] = await db.select().from(editors).where(eq(editors.email, email)).limit(1);
  return row ?? null;
}

export async function addEditor(db: Db, name: string, email: string) {
  const [row] = await db.insert(editors).values({ name, email }).returning({ id: editors.id });
  return row.id;
}

/** Archiving an editor also ends every session they have, so they're signed out at once. */
export async function setEditorArchived(db: Db, id: number, archived: boolean) {
  await runBatch(db, [
    db
      .update(editors)
      .set({ archivedAt: archived ? sql`(unixepoch())` : null })
      .where(eq(editors.id, id)),
    ...(archived ? [db.delete(sessions).where(eq(sessions.editorId, id))] : []),
  ]);
}

export async function renameEditor(db: Db, id: number, name: string) {
  await db.update(editors).set({ name }).where(eq(editors.id, id));
}

/* Activity */

export async function listActivity(
  db: Db,
  { editorId, page, perPage }: { editorId: number | null; page: number; perPage: number },
) {
  const where = editorId ? eq(activityLog.editorId, editorId) : undefined;
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(activityLog).where(where),
    db
      .select({
        id: activityLog.id,
        summary: activityLog.summary,
        at: activityLog.at,
        editor: editors.name,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
      })
      .from(activityLog)
      .leftJoin(editors, eq(editors.id, activityLog.editorId))
      .where(where)
      .orderBy(desc(activityLog.at), desc(activityLog.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
  ]);
  return { rows, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/* Redirects */

export async function listRedirects(db: Db) {
  return db.select().from(redirects).orderBy(desc(redirects.createdAt), asc(redirects.fromPath));
}

/** Adds or replaces a redirect. The new address can't itself redirect, so there are no loops. */
export async function saveRedirect(db: Db, from: string, to: string) {
  await runBatch(db, [
    db.delete(redirects).where(eq(redirects.fromPath, to)),
    db
      .insert(redirects)
      .values({ fromPath: from, toPath: to })
      .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: to } }),
    db.update(redirects).set({ toPath: to }).where(eq(redirects.toPath, from)),
  ]);
}

export async function deleteRedirect(db: Db, from: string) {
  await db.delete(redirects).where(eq(redirects.fromPath, from));
}
