import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import { rehypeImageGallery } from './src/plugins/rehype-image-gallery.mjs';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  site: 'https://www.maggieanddustin.com',
  integrations: [react(), sitemap()],
  adapter: cloudflare(),
  markdown: {
    rehypePlugins: [rehypeImageGallery],
  },
});
