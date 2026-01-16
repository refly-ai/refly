import { lazy, Suspense, ComponentType, useMemo } from 'react';

interface LazyModalProps {
  visible: boolean;
  loader: () => Promise<{ default: ComponentType<any> }>;
  setVisible?: (visible: boolean) => void;
}

/**
 * LazyModal - Lazy load modal component
 *
 * Only load modal component code when visible=true
 * This reduces initial bundle size
 *
 * @param visible - Whether the modal is visible
 * @param loader - Dynamic import function
 * @param setVisible - Optional setter for visibility
 */
export const LazyModal = ({
  visible,
  loader,
  setVisible,
}: LazyModalProps): React.ReactElement | null => {
  // Return null directly when not visible, don't load component
  if (!visible) return null;

  // Memoize lazy component to prevent recreation on every render
  const Component = useMemo(() => lazy(loader), [loader]);

  return (
    <Suspense fallback={null}>
      <Component visible={visible} setVisible={setVisible} />
    </Suspense>
  );
};
