import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: './schema.yml',
  output: {
    format: 'biome',
    path: 'src/',
  },
});
