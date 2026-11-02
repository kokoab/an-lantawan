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
});
