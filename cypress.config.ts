import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    env: {
      databaseUrl: 'postgresql://refly:test@localhost:5432/refly',
    },
  },
});
