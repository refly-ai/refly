import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: './schema.yml',
  output: {
    path: './src',
    format: 'prettier',
  },
  types: {
    enums: 'javascript',
  },
});
