import type { APIRoute } from 'astro';
import { db } from '../../db/client';
import { deleteSession } from '../../db/queries/auth';
import { clearSessionCookie, SESSION_COOKIE } from '../../lib/auth-cookies';

/** POST only, so a link or image on another site can't sign anyone out. */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(db, token);
  clearSessionCookie(cookies);
  return redirect('/admin/signin?signedout=1', 303);
};
