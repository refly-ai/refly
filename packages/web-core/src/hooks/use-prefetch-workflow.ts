import { useEffect, useRef } from 'react';

/**
 * 在 workspace 页面智能预加载 workflow 页面资源
 *
 * 策略：
 * 1. 使用 requestIdleCallback 在浏览器空闲时预加载，不阻塞主线程
 * 2. 预加载 workflow 页面 chunk（包含 Canvas 组件等）
 * 3. 预加载 workflow 依赖的关键库（@xyflow/react）
 * 4. 只预加载一次，避免重复加载
 *
 * 使用场景：
 * - 在 workspace 页面（/workspace）调用
 * - 用户可能会点击某个 workflow 进入编辑页面
 * - 提前加载可以让页面切换更流畅
 */
export const usePrefetchWorkflow = () => {
  const hasPreloadedRef = useRef(false);

  useEffect(() => {
    // 如果已经预加载过，不重复执行
    if (hasPreloadedRef.current) {
      return;
    }

    // 使用 requestIdleCallback 在浏览器空闲时预加载
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

    const idleId = idleCallback(
      () => {
        console.log('[Workspace] Starting workflow resources prefetch...');
        hasPreloadedRef.current = true;

        // 预加载 workflow 页面（包含 Canvas 组件及其依赖）
        // workflow 页面会自动引入所需的依赖：
        // - @xyflow/react (Canvas 核心)
        // - Tiptap (富文本编辑)
        // - 各种 workflow 相关组件
        import('../pages/workflow')
          .then(() => {
            console.log('[Workspace] Workflow page and dependencies loaded');
          })
          .catch((err) => {
            console.warn('[Workspace] Failed to prefetch workflow page:', err);
          });

        // 注意：不预加载 Monaco Editor，因为它很大（~2MB）且不是所有用户都会用到
        // Monaco 会在用户实际打开代码编辑器时按需加载
      },
      { timeout: 3000 }, // 最多等待 3 秒，超时后强制执行
    );

    return () => {
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);
};
