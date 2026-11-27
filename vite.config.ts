import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // The deploy refuses source maps in the output (.github/workflows/deploy.yml).
    sourcemap: false,
    rolldownOptions: {
      // 404.html is built like the main page, so it gets the hashed stylesheet; Cloudflare Pages
      // serves it with status 404 for unknown paths instead of falling back to index.html.
      input: { main: 'index.html', notFound: '404.html' },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
