import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://www.maggieanddustin.com',
  integrations: [react(), sitemap()],
  adapter: cloudflare(),
});
