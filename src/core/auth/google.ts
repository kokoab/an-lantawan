const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export type IdTokenCheck =
  | { ok: true; email: string; name: string | null }
  | { ok: false; reason: 'issuer' | 'audience' | 'expired' | 'unverified' };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Checks the claims of a Google ID token. The token comes straight from Google's token
 * endpoint over HTTPS, so its signature doesn't need checking (OpenID Connect Core 3.1.3.7),
 * but who issued it, who it is for, its expiry and the email must still be checked.
 */
export function checkIdToken(claims: unknown, clientId: string, now: Date): IdTokenCheck {
  const c = (claims ?? {}) as Record<string, unknown>;
  if (typeof c.iss !== 'string' || !ISSUERS.has(c.iss)) return { ok: false, reason: 'issuer' };
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(clientId)) return { ok: false, reason: 'audience' };
  if (typeof c.exp !== 'number' || c.exp * 1000 <= now.getTime())
    return { ok: false, reason: 'expired' };
  if (c.email_verified !== true || typeof c.email !== 'string')
    return { ok: false, reason: 'unverified' };
  return {
    ok: true,
    email: normalizeEmail(c.email),
    name: typeof c.name === 'string' ? c.name : null,
  };
}

/**
 * Where to go after signing in. Only admin paths on this site are allowed, so a link
 * like `/admin/signin?next=https://evil.example` can't send someone elsewhere.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith('/admin') || next.startsWith('//') || next.includes('\\')) {
    return '/admin';
  }
  try {
    const url = new URL(next, 'https://x.invalid');
    const sameSite = url.origin === 'https://x.invalid';
    const isAdmin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
    return sameSite && isAdmin ? `${url.pathname}${url.search}` : '/admin';
  } catch {
    return '/admin';
  }
}
