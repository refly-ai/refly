import { lazy, Suspense, ComponentType } from 'react';

interface LazyModalProps {
  visible: boolean;
  loader: () => Promise<{ default: ComponentType<any> }>;
  [key: string]: any;
}

/**
 * LazyModal - Lazy load modal component
 *
 * Only load modal component code when visible=true
 * This reduces initial bundle size
 *
 * @param visible - Whether the modal is visible
 * @param loader - Dynamic import function
 * @param props - Other props to pass to the modal
 */
export const LazyModal = ({ visible, loader, ...props }: LazyModalProps) => {
  // Return null directly when not visible, don't load component
  if (!visible) return null;

  // Dynamically load component when visible=true
  const Component = lazy(loader);

  return (
    <Suspense fallback={null}>
      <Component {...props} />
    </Suspense>
  );
};
