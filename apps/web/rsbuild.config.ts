import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSvgr } from '@rsbuild/plugin-svgr';
import { pluginSass } from '@rsbuild/plugin-sass';
import { sentryWebpackPlugin } from '@sentry/webpack-plugin';
import NodePolyfill from 'node-polyfill-webpack-plugin';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';
import { PrecacheManifestPlugin } from './config/plugins/precache-manifest-plugin';
import { ChunkDependencyReportPlugin } from './config/plugins/chunk-dependency-report-plugin';

const { publicVars } = loadEnv({ prefixes: ['VITE_', 'PUBLIC_'] });

import path from 'node:path';
import crypto from 'node:crypto';

const gtagId = process.env.VITE_GTAG_ID;

const isProduction = process.env.NODE_ENV === 'production';
const enableBundleAnalyze = process.env.ANALYZE === 'true';
const enableChunkAnalysis = process.env.ANALYZE_CHUNKS === 'true';
const buildVersion = isProduction
  ? crypto.createHash('md5').update(Date.now().toString()).digest('hex').slice(0, 8)
  : 'dev';
const precacheManifestFilename = `precache.${buildVersion}.json`;

const shouldIncludeAsset = (asset: string): boolean => {
  if (!asset) {
    return false;
  }
  if (asset.endsWith('.map')) {
    return false;
  }
  return asset.endsWith('.js') || asset.endsWith('.css');
};

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
      // SERVICE WORKER CONFIGURATION
      // Only enable Service Worker in production to avoid caching issues during development
      if (isProduction) {
        const { InjectManifest } = require('@aaroon/workbox-rspack-plugin');
        // Generate a unique hash based on build time to force SW updates
        const swVersion = buildVersion;

        // Define global variable with SW URL using Rspack's DefinePlugin
        config.plugins = config.plugins || [];
        config.plugins.push(
          new (require('@rspack/core').DefinePlugin)({
            __SERVICE_WORKER_URL__: JSON.stringify(`/service-worker.${swVersion}.js`),
            __PRECACHE_MANIFEST_URL__: JSON.stringify(`/${precacheManifestFilename}`),
          }),
        );

        appendPlugins(
          new InjectManifest({
            swSrc: path.resolve(__dirname, './src/service-worker-sw.ts'),
            swDest: `service-worker.${swVersion}.js`,

            // Two-Stage Precaching Configuration
            // Stage 1: Critical resources (precached during install via __WB_MANIFEST)
            // Stage 2: Non-critical resources (lazy loaded in background by SW itself)
            include: [
              // === Stage 1: Critical Core Resources (~2-3MB) ===
              // These are precached immediately during SW install

              // Core framework libraries (must load immediately)
              /lib-react\.[a-f0-9]+\.js$/, // React (~137KB)
              /lib-router\.[a-f0-9]+\.js$/, // Router (~22KB)
              /index\.[a-f0-9]+\.js$/, // Main entry (~700KB)

              // Core CSS (needed for initial render)
              /static\/css\/index\.[a-f0-9]+\.css$/,

              // Critical page chunks (non-async)
              /static\/js\/(?!async)[^/]+\.[a-f0-9]+\.js$/,

              // === Stage 2: Important but not critical ===
              // High-priority async chunks (workflow, workspace, project)
              /static\/js\/async\/group-workflow[^/]*\.[a-f0-9]+\.js$/,
              /static\/js\/async\/group-workspace\.[a-f0-9]+\.js$/,
              /static\/js\/async\/page-project\.[a-f0-9]+\.js$/,

              // Critical async CSS (for above pages)
              /static\/css\/async\/group-workflow[^/]*\.[a-f0-9]+\.css$/,
              /static\/css\/async\/group-workspace\.[a-f0-9]+\.css$/,
              /static\/css\/async\/page-project\.[a-f0-9]+\.css$/,

              // Note: Other async chunks will be cached on-demand via runtime caching
              // and lazily preloaded in background by Service Worker itself
              // Benefits:
              // 1. Faster initial load (less bandwidth usage)
              // 2. Critical resources available immediately
              // 3. Other resources cached lazily when accessed
              // 4. Background precaching works on ANY page with this SW (even activity pages)
            ],

            // Exclude files that don't need caching
            exclude: [
              /\.map$/, // Source maps
              /asset-manifest\.json$/,
              /\.LICENSE\.txt$/,
              /\.html$/, // Do not precache HTML; runtime caching handles it
              /workbox-.*\.js$/, // Workbox runtime
            ],

            // Increase file size limit to support precaching more resources
            maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30MB limit
          }),
        );

        appendPlugins(
          new PrecacheManifestPlugin({
            shouldIncludeAsset,
            filename: precacheManifestFilename,
          }),
        );
      }

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

      // Bundle analyzer - enabled via ANALYZE=true
      if (enableBundleAnalyze) {
        appendPlugins(
          new RsdoctorRspackPlugin({
            // Enable bundle analysis features
            features: ['bundle', 'plugins', 'loader', 'resolver'],
            // Support for analyzing specific routes/chunks
            supports: {
              generateTileGraph: true,
            },
          }),
        );
      }

      if (enableChunkAnalysis) {
        appendPlugins(new ChunkDependencyReportPlugin());
      }

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

    // Use Rsbuild recommended strategy + force split large libraries
    chunkSplit: {
      strategy: 'split-by-experience', // Official recommended default strategy

      override: {
        cacheGroups: {
          // Disable default cache groups
          default: false,

          // Only extract React core libraries (required by all pages)
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: 'lib-react',
            chunks: 'all',
            priority: 100,
          },

          // Only extract React Router (required by all pages)
          router: {
            test: /[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/,
            name: 'lib-router',
            chunks: 'all',
            priority: 90,
          },

          // Don't extract other vendors, keep them in page chunks
        },

        // Critical: Adjust size limits to reduce splitting
        minSize: 100000, // 100KB - Increase minimum chunk size
        maxSize: 3000000, // 3MB - Allow larger chunks, reduce splitting
      },

      // Goals:
      // - Reduce chunk count (not 54, target 5-10)
      // - Keep each page's dependencies in its own chunk
      // - Don't extract Ant Design to shared chunk
    },
  },
  output: {
    dataUriLimit: 0,
    sourceMap: {
      js: isProduction ? 'source-map' : 'cheap-module-source-map',
      css: true,
    },
    manifest: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@refly-packages/ai-workspace-common': path.resolve(
        __dirname,
        '../../packages/ai-workspace-common/src',
      ),
      '@refly/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@refly/canvas-common': path.resolve(__dirname, '../../packages/canvas-common/src'),
    },
  },
  html: {
    template: './public/index.html',
    tags: [
      {
        tag: 'meta',
        attrs: {
          name: 'app-version',
          content: buildVersion,
        },
      },
      ...(gtagId
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
        : []),
    ],
  },
});
