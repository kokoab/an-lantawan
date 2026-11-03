import type { AstroCookieSetOptions, AstroCookies } from 'astro';

// `__Host-` cookies must be Secure, on path /, with no Domain, so no subdomain can set them.
export const SESSION_COOKIE = '__Host-al_session';
export const OAUTH_STATE_COOKIE = '__Host-al_oauth_state';
export const OAUTH_VERIFIER_COOKIE = '__Host-al_oauth_verifier';
export const OAUTH_NEXT_COOKIE = '__Host-al_oauth_next';

const base: AstroCookieSetOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

/** Without “Remember me”, the cookie lasts until the browser closes. */
export function setSessionCookie(
  cookies: AstroCookies,
  token: string,
  expiresAt: Date,
  remember = true,
) {
  cookies.set(SESSION_COOKIE, token, remember ? { ...base, expires: expiresAt } : base);
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, base);
}

/** Short-lived cookies that tie Google's reply to the browser that started the sign-in. */
export function setOAuthCookies(
  cookies: AstroCookies,
  values: { state: string; verifier: string; next: string },
) {
  const opts = { ...base, maxAge: 10 * 60 };
  cookies.set(OAUTH_STATE_COOKIE, values.state, opts);
  cookies.set(OAUTH_VERIFIER_COOKIE, values.verifier, opts);
  cookies.set(OAUTH_NEXT_COOKIE, values.next, opts);
}

export function clearOAuthCookies(cookies: AstroCookies) {
  for (const name of [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, OAUTH_NEXT_COOKIE]) {
    cookies.delete(name, base);
  }
}
