// Bindings are typed by `wrangler types`. These are optional vars and secrets:
// set vars in wrangler.jsonc, secrets with `wrangler secret put`, and both in .dev.vars locally.
declare namespace Cloudflare {
  interface Env {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET?: string;
  }
}

declare namespace App {
  interface Locals {
    /** The signed-in admin, or null for everyone else. Set by src/middleware.ts. */
    editor: import('./db/queries/auth').SignedInEditor | null;
  }
}
