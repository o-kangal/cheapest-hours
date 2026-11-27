import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // The deploy refuses source maps in the output (.github/workflows/deploy.yml).
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
