import { and, asc, count, desc, eq, gte, isNull, ne, sql } from 'drizzle-orm';
import { runBatch } from '../../batch';
import type { Db } from '../../client';
import { activityLog, editors, people, redirects, sessions } from '../../schema';

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
  f: {
    personId: number | null;
    area: string | null;
    since: Date | null;
    page: number;
    perPage: number;
  },
) {
  const where = and(
    f.personId ? eq(activityLog.personId, f.personId) : undefined,
    f.area ? eq(activityLog.area, f.area) : undefined,
    f.since ? gte(activityLog.at, f.since) : undefined,
    ne(activityLog.action, 'signed_in'),
  );
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(activityLog).where(where),
    db
      .select({
        id: activityLog.id,
        summary: activityLog.summary,
        at: activityLog.at,
        area: activityLog.area,
        undo: activityLog.undo,
        person: people.name,
        account: editors.name,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
      })
      .from(activityLog)
      .leftJoin(people, eq(people.id, activityLog.personId))
      .leftJoin(editors, eq(editors.id, activityLog.editorId))
      .where(where)
      .orderBy(desc(activityLog.at), desc(activityLog.id))
      .limit(f.perPage)
      .offset((f.page - 1) * f.perPage),
  ]);
  return { rows, pages: Math.max(1, Math.ceil(total / f.perPage)) };
}

export async function getActivity(db: Db, id: number) {
  const [row] = await db.select().from(activityLog).where(eq(activityLog.id, id)).limit(1);
  return row ?? null;
}

/** A change can be undone once. */
export async function clearUndo(db: Db, id: number) {
  await db.update(activityLog).set({ undo: null }).where(eq(activityLog.id, id));
}

/** Everyone who appears on the activity log, for its filter. */
export async function listActivityPeople(db: Db) {
  return db
    .selectDistinct({ id: people.id, name: people.name })
    .from(activityLog)
    .innerJoin(people, eq(people.id, activityLog.personId))
    .orderBy(asc(people.name));
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
