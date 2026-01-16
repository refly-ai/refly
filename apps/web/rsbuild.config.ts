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

        appendPlugins(
          new GenerateSW({
            mode: 'production', // Disable Workbox logging
            sourcemap: false,
            // PWA basics
            clientsClaim: true,
            skipWaiting: true,

            // Code Caching Strategy
            // Precache core resources and main page chunks to improve first load experience
            include: [
              // ⚠️ DON'T precache HTML - it changes frequently and has no hash
              // /\.html$/,  // REMOVED to prevent stale HTML issues

              // Core libraries (required by all pages)
              /lib-react\.[a-f0-9]+\.js$/, // React library (~136KB)
              /lib-router\.[a-f0-9]+\.js$/, // Router library (~22KB)

              // Main entry files
              /index\.[a-f0-9]+\.js$/, // Main bundle (~690KB)
              /index\.[a-f0-9]+\.css$/, // Main stylesheet

              // All JS chunks outside async directory (core functionality code)
              /static\/js\/(?!async)[^/]+\.[a-f0-9]+\.js$/,

              // Important page chunks (workspace and workflow)
              /group-workspace\.[a-f0-9]+\.js$/,
              /group-workflow\.[a-f0-9]+\.js$/,
              /group-workflow\.[a-f0-9]+\.css$/,
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
              // === Strategy 0: HTML - StaleWhileRevalidate for best UX ===
              // Serve from cache immediately (fast), then update cache in background
              // This ensures users always see content quickly, and get updates on next visit
              {
                urlPattern: /\.html$/,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'html-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 24 * 60 * 60, // 1 day
                  },
                  // Use network cache for 304 responses
                  plugins: [
                    {
                      cacheWillUpdate: async ({ response }: { response: Response }) => {
                        // Cache 200 responses
                        if (response.status === 200) {
                          return response;
                        }
                        // Don't cache error responses
                        return null;
                      },
                    },
                  ],
                },
              },

              // === Strategy 1: JavaScript chunks - CacheFirst for instant load ===
              // Use CacheFirst strategy to read directly from cache, extremely fast (~0ms)
              // Safe to cache because JS files have hash, filename changes when content changes
              {
                urlPattern: /\.js$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'js-cache-v2', // Increment version to bust old cache
                  expiration: {
                    maxEntries: 60,
                    maxAgeSeconds: 7 * 24 * 60 * 60, // Reduced to 7 days for faster updates
                  },
                  cacheableResponse: {
                    statuses: [200], // Only cache successful responses (avoid caching HTML error pages)
                  },
                },
              },

              // === Strategy 2: CSS - CacheFirst for instant load ===
              // CSS files also have hash, using CacheFirst is safe and fast
              {
                urlPattern: /\.css$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'css-cache-v2', // Increment version
                  expiration: {
                    maxEntries: 40,
                    maxAgeSeconds: 7 * 24 * 60 * 60, // Reduced to 7 days
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
