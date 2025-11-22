import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSvgr } from '@rsbuild/plugin-svgr';
import { pluginSass } from '@rsbuild/plugin-sass';
import { sentryWebpackPlugin } from '@sentry/webpack-plugin';
import NodePolyfill from 'node-polyfill-webpack-plugin';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

const { publicVars } = loadEnv({ prefixes: ['VITE_'] });

import path from 'node:path';

const gtagId = process.env.VITE_GTAG_ID;

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [
    pluginTypeCheck({
      enable:
        process.env.NODE_ENV === 'development' || process.env.VITE_ENFORCE_TYPE_CHECK === 'true',
    }),
    pluginReact(),
    pluginSvgr(),
    pluginSass(),
  ],
  dev: {
    hmr: true,
    liveReload: true,
  },
  tools: {
    rspack: (config, { prependPlugins, appendPlugins }) => {
      process.env.SENTRY_AUTH_TOKEN &&
        appendPlugins(
          sentryWebpackPlugin({
            debug: true,
            org: 'refly-ai',
            project: 'web',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            errorHandler: (err) => console.warn(err),
            sourcemaps: {
              filesToDeleteAfterUpload: ['**/*.js.map'],
            },
          }),
        );
      prependPlugins(
        codeInspectorPlugin({
          bundler: 'rspack',
          editor: 'code',
        }),
      );
      prependPlugins(new NodePolyfill({ additionalAliases: ['process'] }));
      return config;
    },
  },
  server: {
    port: 5173,
    base: process.env.MODE === 'desktop' ? './' : '/',
    proxy: {
      '/v1': {
        target: 'http://localhost:5800',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  source: {
    define: publicVars,
  },
  performance: {
    removeConsole: isProduction,
  },
  output: {
    sourceMap: {
      js: isProduction ? 'source-map' : 'cheap-module-source-map',
      css: true,
    },
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
  html: {
    template: './public/index.html',
    tags: gtagId
      ? [
          {
            tag: 'script',
            attrs: {
              async: true,
              src: `https://www.googletagmanager.com/gtag/js?id=${gtagId}`,
            },
          },
          {
            tag: 'script',
            children: `
          window.dataLayer = window.dataLayer || [];
          function gtag() {
            dataLayer.push(arguments);
          }
          gtag('js', new Date());
          gtag('config', '${gtagId}');
      `,
          },
        ]
      : [],
  },
});
