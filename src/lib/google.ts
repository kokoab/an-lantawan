import { env } from 'cloudflare:workers';
import { Google } from 'arctic';

/** Google sign-in client, or null if the client ID and secret aren't set yet. */
export function googleClient(origin: string) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    google: new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, `${origin}/auth/callback`),
  };
}
