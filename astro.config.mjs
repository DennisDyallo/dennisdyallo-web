// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkWikilinks from './src/lib/remark-wikilinks.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://dyallo.se',
  output: 'static',
  integrations: [sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/dashboard') })],
  markdown: {
    remarkPlugins: [remarkWikilinks],
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
