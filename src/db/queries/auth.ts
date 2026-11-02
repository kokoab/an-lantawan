import { and, eq, isNull, lt } from 'drizzle-orm';
import { generateToken, hashToken, newExpiry, sessionState } from '../../core/auth/session';
import type { Db } from '../client';
import { editors, sessions } from '../schema';

export interface SignedInEditor {
  id: number;
  name: string;
  email: string;
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
): Promise<{ editor: SignedInEditor; expiresAt: Date; extended: boolean } | null> {
  const id = await hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      editor: { id: editors.id, name: editors.name, email: editors.email },
      archivedAt: editors.archivedAt,
    })
    .from(sessions)
    .innerJoin(editors, eq(editors.id, sessions.editorId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row) return null;

  const state = sessionState(row.expiresAt, now);
  if (state === 'expired' || row.archivedAt) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (state === 'refresh') {
    const expiresAt = newExpiry(now);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    return { editor: row.editor, expiresAt, extended: true };
  }
  return { editor: row.editor, expiresAt: row.expiresAt, extended: false };
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, await hashToken(token)));
}
