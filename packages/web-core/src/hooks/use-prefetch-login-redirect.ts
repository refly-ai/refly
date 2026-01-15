import { useEffect } from 'react';

/**
 * 路由匹配规则 - 根据路径匹配对应的页面 chunk
 */
const ROUTE_CHUNK_MAP: Array<{
  pattern: RegExp;
  loader: () => Promise<any>;
  name: string;
}> = [
  {
    pattern: /^\/workspace$/,
    loader: () => import('../pages/workspace'),
    name: 'workspace',
  },
  {
    pattern: /^\/workflow\/[^/]+$/,
    loader: () => import('../pages/workflow'),
    name: 'workflow',
  },
  {
    pattern: /^\/workflow-list$/,
    loader: () => import('../pages/workflow-list'),
    name: 'workflow-list',
  },
  {
    pattern: /^\/run-history(\/[^/]+)?$/,
    loader: () => import('../pages/run-history'),
    name: 'run-history',
  },
  {
    pattern: /^\/marketplace$/,
    loader: () => import('../pages/marketplace'),
    name: 'marketplace',
  },
  {
    pattern: /^\/pricing$/,
    loader: () => import('../pages/pricing'),
    name: 'pricing',
  },
  {
    pattern: /^\/workflow-template\/[^/]+$/,
    loader: () => import('../pages/workflow-app'),
    name: 'workflow-app',
  },
  {
    pattern: /^\/share\/canvas\/[^/]+$/,
    loader: () => import('../pages/share'),
    name: 'share-canvas',
  },
];

/**
 * 根据路径匹配并预加载对应的页面 chunk
 */
const prefetchPageChunk = (pathname: string): void => {
  // 查找匹配的路由规则
  const matchedRoute = ROUTE_CHUNK_MAP.find((route) => route.pattern.test(pathname));

  if (matchedRoute) {
    console.log(`[Login Prefetch] Preloading chunk for: ${matchedRoute.name} (${pathname})`);
    matchedRoute
      .loader()
      .then(() => {
        console.log(`[Login Prefetch] Successfully loaded chunk: ${matchedRoute.name}`);
      })
      .catch((error) => {
        console.warn(`[Login Prefetch] Failed to load chunk ${matchedRoute.name}:`, error);
      });
  } else {
    console.log(`[Login Prefetch] No matching route found for: ${pathname}`);
  }
};

/**
 * 在 login 页面智能预加载登录后可能跳转的页面
 *
 * 逻辑：
 * 1. 如果有 returnUrl 参数，预加载对应的页面 chunk
 * 2. 如果没有 returnUrl，默认预加载 workspace 页面（因为登录后默认跳转到 workspace）
 *
 * 特点：
 * - 使用 requestIdleCallback 在浏览器空闲时预加载，不阻塞主线程
 * - 使用动态 import() 预加载实际的 JS chunk，而不是 HTML
 * - 支持路径匹配，自动识别需要预加载的页面
 *
 * @param returnUrl - 登录后跳转的目标 URL（可选）
 */
export const usePrefetchLoginRedirect = (returnUrl?: string | null) => {
  useEffect(() => {
    // 使用 requestIdleCallback 在浏览器空闲时预加载
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

    const idleId = idleCallback(() => {
      if (returnUrl) {
        // 有 returnUrl - 解析并预加载对应的页面
        try {
          const decodedUrl = decodeURIComponent(returnUrl);
          // 提取路径部分（移除 query params 和 hash）
          const urlPath = decodedUrl.split('?')[0]?.split('#')[0];

          // 检查是否是内部路径
          if (urlPath?.startsWith('/')) {
            prefetchPageChunk(urlPath);
          } else {
            // 外部 URL 不需要预加载
            console.log('[Login Prefetch] External URL, skipping prefetch:', urlPath);
          }
        } catch (error) {
          console.warn('[Login Prefetch] Failed to parse returnUrl:', error);
        }
      } else {
        // 没有 returnUrl - 默认预加载 workspace（登录后的默认跳转页面）
        console.log('[Login Prefetch] No returnUrl, preloading default: workspace');
        prefetchPageChunk('/workspace');
      }
    });

    return () => {
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [returnUrl]);
};
