import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import pruneUnreferencedAssets from './src/integrations/prune-unreferenced-assets.mjs';

// Static output. No UI framework, no client router, no hydration runtime.
export default defineConfig({
  site: 'https://nishchalpanta.com.np',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // Astro emits content-hashed asset filenames, so these are safe to cache forever.
    assets: '_astro',
  },
  image: {
    // WebP only. AVIF is not worth the encode time at this image count.
    responsiveStyles: false,
  },
  integrations: [pruneUnreferencedAssets()],
  vite: {
    resolve: {
      alias: {
        '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      },
    },
  },
});