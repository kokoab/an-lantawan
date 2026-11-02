// Optional secrets, set with `wrangler secret put`. Bindings are typed by `wrangler types`.
declare namespace Cloudflare {
  interface Env {
    TURNSTILE_SECRET?: string;
    TURNSTILE_SITE_KEY?: string;
  }
}
