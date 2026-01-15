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
      // 只在生产环境启用 Service Worker，避免开发时缓存问题
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
            // 只预缓存核心代码，页面 chunks 通过 runtime cache 按需加载
            include: [
              /\.html$/,
              // 核心 chunks（所有页面都需要）
              /lib-react\.[a-f0-9]+\.js$/, // React library (~136KB)
              /lib-router\.[a-f0-9]+\.js$/, // Router library (~22KB)
              // 注意：不预缓存 index~*.js，让它们通过 runtime cache 按需加载
              // 这样首次安装 SW 时不会下载 3.5MB 的代码
            ],

            // 排除不需要缓存的文件
            exclude: [
              /\.map$/, // Source maps
              /asset-manifest\.json$/,
              /\.LICENSE\.txt$/,
              /workbox-.*\.js$/, // Workbox runtime
            ],

            // Runtime caching strategies
            runtimeCaching: [
              // === Strategy 1: JavaScript chunks - CacheFirst for instant load ===
              // 使用 CacheFirst 策略，从缓存直接读取，极快（~0ms）
              // 因为 JS 文件有 hash，内容变化时文件名会变，所以缓存安全
              {
                urlPattern: /\.js$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'js-cache-v1',
                  expiration: {
                    maxEntries: 60,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                  },
                  cacheableResponse: {
                    statuses: [200], // 只缓存成功的响应（避免缓存 HTML 错误页）
                  },
                },
              },

              // === Strategy 2: CSS - CacheFirst for instant load ===
              // CSS 文件也有 hash，使用 CacheFirst 安全且快速
              {
                urlPattern: /\.css$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'css-cache-v1',
                  expiration: {
                    maxEntries: 40,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
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

            // 完全禁用 navigateFallback 以避免 JS 文件被错误缓存为 HTML
            // SPA 路由由前端处理，不需要 fallback
            // navigateFallback: '/index.html',

            // 所有 chunks 都通过 runtime cache 按需加载和缓存
            maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20MB to be safe
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

    // 使用 Rsbuild 推荐的策略 + 强制分离大型库
    chunkSplit: {
      strategy: 'split-by-experience', // 官方推荐的默认策略

      override: {
        cacheGroups: {
          // 禁用默认的 cache groups
          default: false,

          // 只提取 React 核心库（所有页面都需要）
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: 'lib-react',
            chunks: 'all',
            priority: 100,
          },

          // 只提取 React Router（所有页面都需要）
          router: {
            test: /[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/,
            name: 'lib-router',
            chunks: 'all',
            priority: 90,
          },

          // 不提取其他 vendor，让它们留在页面 chunk 中
        },

        // 关键：调整大小限制，减少拆分数量
        minSize: 100000, // 100KB - 增大最小 chunk 大小
        maxSize: 3000000, // 3MB - 允许更大的 chunk，减少拆分
      },

      // 目标：
      // - 减少 chunk 数量（不要 54 个，目标 5-10 个）
      // - 每个页面的依赖留在自己的 chunk 中
      // - Ant Design 不被提取到共享 chunk
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
