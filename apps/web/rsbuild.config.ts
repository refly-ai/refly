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
      // TODO: Uncomment this block after successfully installing 'workbox-webpack-plugin'
      // Run: pnpm add -D workbox-webpack-plugin --filter=@refly/web

      const { GenerateSW } = require('workbox-webpack-plugin');

      appendPlugins(
        new GenerateSW({
          // PWA basics
          clientsClaim: true,
          skipWaiting: true,

          // Code Caching Strategy - 简化版，只缓存核心代码
          // 策略：让页面专用的代码通过 runtime cache 按需缓存
          include: [
            /\.html$/,
            /\.css$/,
            // 只预缓存核心 chunks
            /index\.[a-f0-9]+\.js$/, // Main app bundle
            /lib-react\.[a-f0-9]+\.js$/, // React library
            /lib-router\.[a-f0-9]+\.js$/, // Router library
          ],

          // 所有其他 chunks（包括 vendor）通过 runtime cache 按需缓存
          exclude: [
            /\.map$/, // Source maps
            /asset-manifest\.json$/,
            /\.LICENSE\.txt$/,
          ],

          // Runtime caching strategies
          runtimeCaching: [
            // === Strategy 1: JavaScript chunks - CacheFirst for faster load ===
            {
              urlPattern: /\.js$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'js-runtime',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },

            // === Strategy 2: CSS - StaleWhileRevalidate for style updates ===
            {
              urlPattern: /\.css$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'css-runtime',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
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

          // Navigation fallback
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/v1/, /^\/api/], // Exclude API calls

          // 所有 chunks 都通过 runtime cache 按需加载和缓存
          maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20MB to be safe
        }),
      );

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

    // Chunk splitting strategy to reduce bundle size
    chunkSplit: {
      strategy: 'split-by-experience',
      minSize: 20000,
      maxSize: 500000,

      // 关键配置：提高 minChunks 阈值
      // 只有被 3+ 个 chunk 使用的模块才会被提取到共享 chunk
      // Ant Design 虽然被 workspace 和 workflow 使用（2个），不会被提取
      override: {
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            minChunks: 3, // 关键！只有被 3+ 个页面使用才提取
          },
        },
      },

      // 目标：
      // - Ant Design 被 2 个页面使用，不会被提取到共享 chunk
      // - workspace 页面包含自己的 Ant Design 组件
      // - workflow 页面包含自己的 Ant Design 组件
      // - 稍微有重复，但第一次加载体验更重要！
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
