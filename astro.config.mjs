// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
import { buildSidebar } from './src/data/curriculum.mjs';
import { site as siteConfig } from './src/data/site.mjs';

export default defineConfig({
  site: siteConfig.url,
  markdown: {
    // Math via KaTeX. Single $ is left alone for prices; write math as $$...$$ (inline or block).
    processor: unified({ remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]], rehypePlugins: [rehypeKatex] }),
  },
  integrations: [
    starlight({
      title: siteConfig.name,
      description: siteConfig.description,
      logo: { src: './src/assets/logo.svg', replacesTitle: false },
      favicon: '/favicon.svg',
      customCss: [
        './src/styles/global.css',
        'katex/dist/katex.min.css',
        '@fontsource-variable/inter',
        '@fontsource-variable/jetbrains-mono',
      ],
      sidebar: buildSidebar(),
      lastUpdated: false,
      pagination: true,
      components: {
        PageTitle: './src/components/overrides/PageTitle.astro',
        Footer: './src/components/overrides/Footer.astro',
      },
      head: [
        // Restore the reader's chosen explanation level before first paint.
        {
          tag: 'script',
          content:
            "try{var l=localStorage.getItem('mv-level');if(l)document.documentElement.dataset.level=l}catch(e){}",
        },
      ],
    }),
    react(),
  ],
  vite: { plugins: [tailwindcss()] },
});
