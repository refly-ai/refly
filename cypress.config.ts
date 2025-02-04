import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    viewportWidth: 1920,
    viewportHeight: 1080,
    baseUrl: 'http://localhost:5173',
    env: {
      apiUrl: 'http://localhost:5800',
      databaseUrl: 'postgresql://refly:test@localhost:5432/refly',
    },
  },
});
