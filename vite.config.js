import { defineConfig } from 'vite';

export default defineConfig({
  // relative base: works on GitHub Pages subpath AND any local static server
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5173 },
});
