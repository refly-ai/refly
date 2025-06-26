import { defineConfig, searchForWorkspaceRoot, UserConfig } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import preload from 'vite-plugin-preload';
import path from 'node:path';
import postcss from './postcss.config';
import { vitePluginForArco } from '@refly/arco-vite-plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { gtagPlugin } from './vite-gtag-plugin';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    base: process.env.MODE === 'desktop' ? './' : '/',
    plugins: [
      react(),
      preload(),
      tsconfigPaths(),
      gtagPlugin(),
      vitePluginForArco({
        theme: '@arco-themes/react-refly-ai',
        filePatterns: ['apps/web/src', 'packages/ai-workspace-common/src', 'apps/extension/src'],
      }),
      codeInspectorPlugin({
        bundler: 'vite',
        editor: 'code',
      }),
      sentryVitePlugin({
        debug: true,
        org: 'refly-ai',
        project: 'web',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        errorHandler: (err) => console.warn(err),
        sourcemaps: {
          filesToDeleteAfterUpload: ['**/*.js.map'],
        },
      }),
    ],
    css: {
      postcss,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@refly-packages/ai-workspace-common': path.resolve(
          __dirname,
          '../../packages/ai-workspace-common/src',
        ),
        '@refly/utils': path.resolve(__dirname, '../../packages/utils/src'),
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      sourcemap: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: !isDev,
          drop_debugger: !isDev,
        },
      },
    },
    esbuild: {
      drop: isDev ? [] : ['console', 'debugger'],
    },
    server: {
      fs: {
        strict: false,
        allow: [searchForWorkspaceRoot(process.cwd())],
      },
    },
  } as UserConfig;
});
