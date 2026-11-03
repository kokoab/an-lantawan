import { defineMiddleware } from 'astro:middleware';
import { db } from './db/client';
import { validateSession } from './db/queries/auth';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from './lib/auth-cookies';
import { FALLBACK_CSP, SECURITY_HEADERS } from './lib/security-headers';

/** Admin pages anyone may open: the sign-in screen and the "not on the list" screen. */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/signin', '/admin/denied']);
/** Signed in, but nobody has said who is editing yet: only the picker opens. */
const PICK_PERSON_PATH = '/admin/who';

const isAdminPage = (path: string) => path === '/admin' || path.startsWith('/admin/');
const isAdminApi = (path: string) => path.startsWith('/api/admin/');

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, url, locals } = context;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  locals.editor = null;

  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await validateSession(db, token);
    if (session) {
      locals.editor = session.editor;
      if (session.extended) setSessionCookie(cookies, token, session.expiresAt, session.remember);
    } else {
      clearSessionCookie(cookies);
    }
  }

  // Default deny: every admin page and admin API needs a signed-in editor.
  if (!locals.editor) {
    if (isAdminApi(path)) {
      return Response.json({ ok: false, error: 'signed_out' }, { status: 401 });
    }
    if (isAdminPage(path) && !PUBLIC_ADMIN_PATHS.has(path)) {
      const nextPath = encodeURIComponent(`${url.pathname}${url.search}`);
      return context.redirect(`/admin/signin?next=${nextPath}`, 303);
    }
  }

  // Signed in with the shared account, but nobody picked a name: everything waits on the picker.
  if (
    locals.editor &&
    !locals.editor.person &&
    path !== PICK_PERSON_PATH &&
    !PUBLIC_ADMIN_PATHS.has(path)
  ) {
    if (isAdminApi(path)) {
      return Response.json({ ok: false, error: 'pick_person' }, { status: 401 });
    }
    if (isAdminPage(path)) {
      const nextPath = encodeURIComponent(`${url.pathname}${url.search}`);
      return context.redirect(`${PICK_PERSON_PATH}?next=${nextPath}`, 303);
    }
  }

  const response = await next();
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  // Pages get their policy from Astro (in production builds); everything else gets the strict one.
  const isPage = headers.get('Content-Type')?.startsWith('text/html');
  if (!isPage && !headers.has('Content-Security-Policy')) {
    headers.set('Content-Security-Policy', FALLBACK_CSP);
  }
  if (isAdminPage(path) || isAdminApi(path) || path.startsWith('/auth/')) {
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
