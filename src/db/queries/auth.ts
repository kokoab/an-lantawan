import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { generateToken, hashToken, newExpiry, sessionState } from '../../core/auth/session';
import type { Db } from '../client';
import { editors, people, sessions, staffTerms } from '../schema';

/**
 * Who is using the admin: the Google account that signed in (usually the publication's
 * shared account) and the staff member picked on “Who’s editing?”.
 */
export interface SignedInEditor {
  id: number;
  name: string;
  email: string;
  person: { id: number; name: string } | null;
}

/** The editor with this email, if they are allowed in (listed and not archived). */
export async function findActiveEditor(db: Db, email: string) {
  const [editor] = await db
    .select({ id: editors.id, name: editors.name, email: editors.email })
    .from(editors)
    .where(and(eq(editors.email, email), isNull(editors.archivedAt)))
    .limit(1);
  return editor ?? null;
}

/** Starts a session and returns the token for the cookie. Also clears expired sessions. */
export async function createSession(db: Db, editorId: number, now = new Date()) {
  const token = generateToken();
  const expiresAt = newExpiry(now);
  await db.batch([
    db.delete(sessions).where(lt(sessions.expiresAt, now)),
    db.insert(sessions).values({ id: await hashToken(token), editorId, expiresAt }),
  ]);
  return { token, expiresAt };
}

/**
 * The editor behind a cookie token, or null. Expired sessions and archived editors are
 * rejected. Sessions past the halfway mark are extended; `expiresAt` then says until when.
 */
export async function validateSession(
  db: Db,
  token: string,
  now = new Date(),
): Promise<{
  editor: SignedInEditor;
  expiresAt: Date;
  extended: boolean;
  remember: boolean;
} | null> {
  const id = await hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      remember: sessions.remember,
      editor: { id: editors.id, name: editors.name, email: editors.email },
      archivedAt: editors.archivedAt,
      personId: people.id,
      personName: people.name,
      personAllowed: people.canEdit,
      personArchived: people.archivedAt,
    })
    .from(sessions)
    .innerJoin(editors, eq(editors.id, sessions.editorId))
    .leftJoin(people, eq(people.id, sessions.personId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row) return null;

  const state = sessionState(row.expiresAt, now, row.remember);
  if (state === 'expired' || row.archivedAt) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  // Someone taken off the editing list has to pick again (and can't pick themselves).
  const person =
    row.personId && row.personName && row.personAllowed && !row.personArchived
      ? { id: row.personId, name: row.personName }
      : null;
  const editor = { ...row.editor, person };
  if (state === 'refresh') {
    const expiresAt = newExpiry(now, row.remember);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    return { editor, expiresAt, extended: true, remember: row.remember };
  }
  return { editor, expiresAt: row.expiresAt, extended: false, remember: row.remember };
}

/** Staff who can edit, for “Who’s editing?”, with their newest position. */
export async function listEditingPeople(db: Db) {
  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      position: staffTerms.position,
      year: staffTerms.schoolYear,
    })
    .from(people)
    .leftJoin(staffTerms, eq(staffTerms.personId, people.id))
    .where(and(eq(people.canEdit, true), isNull(people.archivedAt)))
    .orderBy(people.name, desc(staffTerms.schoolYear), staffTerms.sort);
  const seen = new Map<number, { id: number; name: string; position: string | null }>();
  for (const r of rows)
    if (!seen.has(r.id)) seen.set(r.id, { id: r.id, name: r.name, position: r.position });
  return [...seen.values()];
}

/** Records who is editing in this session, and for how long the session lasts. */
export async function chooseSessionPerson(
  db: Db,
  token: string,
  personId: number,
  remember: boolean,
  now = new Date(),
) {
  const expiresAt = newExpiry(now, remember);
  await db
    .update(sessions)
    .set({ personId, remember, expiresAt })
    .where(eq(sessions.id, await hashToken(token)));
  return expiresAt;
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, await hashToken(token)));
}
