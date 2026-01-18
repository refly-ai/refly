import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSvgr } from '@rsbuild/plugin-svgr';
import { pluginSass } from '@rsbuild/plugin-sass';
import { sentryWebpackPlugin } from '@sentry/webpack-plugin';
import NodePolyfill from 'node-polyfill-webpack-plugin';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';

const { publicVars } = loadEnv({ prefixes: ['VITE_'] });

import path from 'node:path';

const gtagId = process.env.VITE_GTAG_ID;

const isProduction = process.env.NODE_ENV === 'production';
const enableBundleAnalyze = process.env.ANALYZE === 'true';

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
      // ... existing plugins ...
      // SERVICE WORKER CONFIGURATION
      // Only enable Service Worker in production to avoid caching issues during development
      if (isProduction) {
        const { GenerateSW } = require('workbox-webpack-plugin');
        const crypto = require('node:crypto');

        // Generate a unique hash based on build time to force SW updates
        const swVersion = crypto
          .createHash('md5')
          .update(Date.now().toString())
          .digest('hex')
          .slice(0, 8);

        // Define global variable with SW URL using Rspack's DefinePlugin
        config.plugins = config.plugins || [];
        config.plugins.push(
          new (require('@rspack/core').DefinePlugin)({
            __SERVICE_WORKER_URL__: JSON.stringify(`/service-worker.${swVersion}.js`),
          }),
        );

        appendPlugins(
          new GenerateSW({
            swDest: `service-worker.${swVersion}.js`, // Add version hash to SW filename
            mode: 'production', // Disable Workbox logging
            sourcemap: false,
            // PWA basics
            clientsClaim: true,
            skipWaiting: true,

            // Code Caching Strategy
            // Precache core resources and main page chunks to improve first load experience
            include: [
              // HTML files - precache for instant subsequent visits
              /\.html$/,

              // Core libraries (required by all pages)
              /lib-react\.[a-f0-9]+\.js$/, // React library (~136KB)
              /lib-router\.[a-f0-9]+\.js$/, // Router library (~22KB)

              // Main entry files
              /index\.[a-f0-9]+\.js$/, // Main bundle (~690KB)
              /index\.[a-f0-9]+\.css$/, // Main stylesheet

              // All JS chunks outside async directory (core functionality code)
              /static\/js\/(?!async)[^/]+\.[a-f0-9]+\.js$/,

              // Note: We intentionally DON'T precache group-workspace and group-workflow
              // They will be loaded on-demand and cached by runtime caching
              // This reduces initial SW installation time and bandwidth
            ],

            // Exclude files that don't need caching
            exclude: [
              /\.map$/, // Source maps
              /asset-manifest\.json$/,
              /\.LICENSE\.txt$/,
              /workbox-.*\.js$/, // Workbox runtime
            ],

            // Runtime caching strategies
            runtimeCaching: [
              // === Strategy 0: HTML - StaleWhileRevalidate for instant load ===
              // Serve cached HTML immediately (fast!), then update cache in background
              // Users see content instantly, and get updates on next visit/refresh
              {
                urlPattern: ({ request, url }: { request: Request; url: URL }) =>
                  request.destination === 'document' && url.pathname !== '/',
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'html-cache-v1',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 24 * 60 * 60, // 1 day
                  },
                  plugins: [
                    {
                      cacheWillUpdate: async ({ response }: { response: Response }) => {
                        // Only cache successful responses
                        if (response && response.status === 200) {
                          return response;
                        }
                        return null;
                      },
                    },
                  ],
                },
              },

              // Note: Async JS chunks are cached via runtime strategy below.

              // === Strategy 1: Core JS chunks (not async) - CacheFirst ===
              // Only cache non-async JS files that were precached
              {
                urlPattern: ({ url }: { url: URL }) => {
                  return url.pathname.endsWith('.js') && !url.pathname.includes('/async/');
                },
                handler: 'CacheFirst',
                options: {
                  cacheName: 'js-cache-v4',
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 365 * 24 * 60 * 60,
                  },
                  cacheableResponse: {
                    statuses: [200],
                  },
                },
              },

              // === Strategy 1.1: Async JS chunks - CacheFirst ===
              {
                urlPattern: ({ url }: { url: URL }) => {
                  return url.pathname.endsWith('.js') && url.pathname.includes('/async/');
                },
                handler: 'CacheFirst',
                options: {
                  cacheName: 'js-async-cache-v1',
                  expiration: {
                    maxEntries: 60,
                    maxAgeSeconds: 365 * 24 * 60 * 60,
                  },
                  cacheableResponse: {
                    statuses: [200],
                  },
                },
              },

              // === Strategy 2: CSS - CacheFirst ===
              {
                urlPattern: /\.css$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'css-cache-v4',
                  expiration: {
                    maxEntries: 40,
                    maxAgeSeconds: 365 * 24 * 60 * 60,
                  },
                  cacheableResponse: {
                    statuses: [200],
                  },
                },
              },

              // === Strategy 3: Images - CacheFirst with longer expiration ===
              {
                urlPattern: /\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images',
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                  },
                },
              },

              // === Strategy 4: Fonts - CacheFirst with very long expiration ===
              {
                urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'fonts',
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                  },
                },
              },

              // === Strategy 5: Google Fonts ===
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com/,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'google-fonts-stylesheets',
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-webfonts',
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                  },
                },
              },
            ],

            // Completely disable navigateFallback to avoid JS files being incorrectly cached as HTML
            // SPA routing is handled by frontend, no fallback needed
            // navigateFallback: '/index.html',

            // Increase file size limit to support precaching more resources
            // Estimated total size: ~3-4MB (core libraries + main bundle + non-async chunks + workflow/workspace)
            maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30MB limit
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
