import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://an-lantawan.anlantawan.workers.dev',
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [svelte()],
  session: false,
  devToolbar: { enabled: false },
  security: {
    // Rejects form posts that come from another site.
    checkOrigin: true,
    // Only scripts and styles from this site (plus the few services named here) can run.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        'font-src https://fonts.gstatic.com',
        "connect-src 'self'",
        'frame-src https://challenges.cloudflare.com',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ],
      styleDirective: { resources: ["'self'", 'https://fonts.googleapis.com'] },
      scriptDirective: { resources: ["'self'", 'https://challenges.cloudflare.com'] },
    },
  },
});
