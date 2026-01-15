import { lazy, Suspense, ComponentType } from 'react';

interface LazyModalProps {
  visible: boolean;
  loader: () => Promise<{ default: ComponentType<any> }>;
  [key: string]: any;
}

/**
 * LazyModal - 懒加载模态框组件
 *
 * 只有当 visible=true 时才加载模态框组件代码
 * 这样可以减少初始加载的 bundle 大小
 *
 * @param visible - 模态框是否显示
 * @param loader - 动态导入函数
 * @param props - 传递给模态框的其他 props
 */
export const LazyModal = ({ visible, loader, ...props }: LazyModalProps) => {
  // 不显示时直接返回 null，不加载组件
  if (!visible) return null;

  // 当 visible=true 时，动态加载组件
  const Component = lazy(loader);

  return (
    <Suspense fallback={null}>
      <Component {...props} />
    </Suspense>
  );
};
