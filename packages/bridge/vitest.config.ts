import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 30000, // K8s operations may be slow
    hookTimeout: 30000,
    globals: true,
  },
});
