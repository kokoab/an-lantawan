import { env } from 'cloudflare:workers';
import { generateCodeVerifier, generateState } from 'arctic';
import type { APIRoute } from 'astro';
import { safeNextPath } from '../../core/auth/google';
import { setOAuthCookies } from '../../lib/auth-cookies';
import { googleClient } from '../../lib/google';
import { underLimit } from '../../lib/rate-limit';

/** Sends the browser to Google's account picker. */
export const GET: APIRoute = async ({ request, url, cookies, redirect }) => {
  if (!(await underLimit(env.AUTH_LIMITER, request, 'auth'))) {
    return redirect('/admin/signin?error=busy', 303);
  }
  const client = googleClient(url.origin);
  if (!client) return redirect('/admin/signin?error=not_configured', 303);

  const state = generateState();
  const verifier = generateCodeVerifier();
  const authUrl = client.google.createAuthorizationURL(state, verifier, [
    'openid',
    'email',
    'profile',
  ]);
  authUrl.searchParams.set('prompt', 'select_account');

  setOAuthCookies(cookies, { state, verifier, next: safeNextPath(url.searchParams.get('next')) });
  return redirect(authUrl.toString(), 303);
};
