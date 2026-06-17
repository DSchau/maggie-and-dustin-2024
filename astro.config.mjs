import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import { rehypeImageGallery } from './src/plugins/rehype-image-gallery.mjs';

// Load font/binary files as ArrayBuffers so they can be passed to Satori
// (ImageResponse) on Cloudflare, which has no filesystem at runtime.
function arrayBufferPlugin() {
  return {
    name: 'arraybuffer-loader',
    transform(_code, id) {
      if (/\.(ttf|otf|woff|woff2|bin)$/.test(id)) {
        const buffer = readFileSync(id);
        return {
          code: `export default new Uint8Array([${Array.from(buffer).join(',')}]).buffer`,
          map: null,
        };
      }
    },
  };
}

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://maggieanddustin.com',
  integrations: [react(), sitemap()],
  adapter: cloudflare(),
  markdown: {
    rehypePlugins: [rehypeImageGallery],
  },
  vite: {
    plugins: [arrayBufferPlugin()],
    ssr: {
      noExternal: ['@cloudflare/pages-plugin-vercel-og'],
    },
  },
});
