import { env } from 'cloudflare:workers';
import { decodeIdToken } from 'arctic';
import type { APIRoute } from 'astro';
import { checkIdToken, safeNextPath } from '../../core/auth/google';
import { db } from '../../db/client';
import { logActivity } from '../../db/queries/activity';
import { createSession, findActiveEditor } from '../../db/queries/auth';
import {
  clearOAuthCookies,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  setSessionCookie,
} from '../../lib/auth-cookies';
import { googleClient } from '../../lib/google';
import { underLimit } from '../../lib/rate-limit';

/** Google sends the browser back here after the person picks an account. */
export const GET: APIRoute = async ({ request, url, cookies, redirect }) => {
  const fail = (error: string) => {
    clearOAuthCookies(cookies);
    return redirect(`/admin/signin?error=${error}`, 303);
  };

  if (!(await underLimit(env.AUTH_LIMITER, request, 'auth'))) return fail('busy');
  const client = googleClient(url.origin);
  if (!client) return fail('not_configured');
  if (url.searchParams.get('error')) return fail('cancelled');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = cookies.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  const next = safeNextPath(cookies.get(OAUTH_NEXT_COOKIE)?.value);
  // The state must match the one this browser was given, or the reply isn't ours.
  if (!code || !state || !savedState || !verifier || state !== savedState) return fail('expired');

  let claims: unknown;
  try {
    const tokens = await client.google.validateAuthorizationCode(code, verifier);
    claims = decodeIdToken(tokens.idToken());
  } catch (err) {
    console.error('Google sign-in failed', err);
    return fail('google');
  }

  const checked = checkIdToken(claims, client.clientId, new Date());
  if (!checked.ok) {
    console.warn('Rejected Google ID token:', checked.reason);
    return fail('google');
  }

  const editor = await findActiveEditor(db, checked.email);
  clearOAuthCookies(cookies);
  if (!editor) {
    console.warn('Sign-in refused for an email not on the admin list');
    return redirect('/admin/denied', 303);
  }

  const { token, expiresAt } = await createSession(db, editor.id);
  setSessionCookie(cookies, token, expiresAt);
  await logActivity(db, {
    editorId: editor.id,
    action: 'signed_in',
    entityType: 'editor',
    entityId: editor.id,
    summary: `${editor.name} signed in as ${editor.email}`,
  });
  return redirect(next, 303);
};
