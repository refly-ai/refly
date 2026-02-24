import { Collapse, CollapseProps } from 'antd';
import { memo, useState, useCallback, useMemo } from 'react';
import type { Key } from 'react';

/**
 * LazyCollapse - Collapse component with lazy loading support
 *
 * Features:
 * - Only renders panel content when first expanded
 * - Keeps content mounted after first render (no re-render on collapse/expand)
 * - Supports all standard Collapse props
 *
 * Usage:
 * ```tsx
 * <LazyCollapse
 *   items={[
 *     {
 *       key: '1',
 *       label: 'Panel 1',
 *       children: <ExpensiveComponent />, // Only renders when first expanded
 *     },
 *   ]}
 * />
 * ```
 */
export const LazyCollapse = memo((props: CollapseProps) => {
  const { items, onChange, ...restProps } = props;

  // Track which panels have been rendered at least once
  const [renderedPanels, setRenderedPanels] = useState<Set<Key>>(new Set());

  // Handle panel expansion
  const handleChange = useCallback(
    (activeKeys: string | string[]) => {
      // Add newly expanded panels to rendered set
      const keys = Array.isArray(activeKeys) ? activeKeys : [activeKeys];
      setRenderedPanels((prev) => {
        let hasNew = false;
        for (const key of keys) {
          if (!prev.has(key)) {
            hasNew = true;
            break;
          }
        }
        if (!hasNew) return prev;
        const newSet = new Set(prev);
        for (const key of keys) {
          newSet.add(key);
        }
        return newSet;
      });

      // Call original onChange if provided
      if (onChange) {
        // Type assertion needed because onChange can accept both string and string[]
        (onChange as (activeKeys: string | string[]) => void)(activeKeys);
      }
    },
    [onChange],
  );

  // Wrap items to conditionally render children
  const lazyItems = useMemo(() => {
    if (!items) return items;

    return items.map((item) => ({
      ...item,
      // Only render children if panel has been expanded at least once
      // Defensively handle undefined keys - panels with undefined key never lazy-gate
      children:
        item.key != null && renderedPanels.has(item.key)
          ? item.children
          : item.key == null
            ? item.children
            : null,
    }));
  }, [items, renderedPanels]);

  return <Collapse {...restProps} items={lazyItems} onChange={handleChange} />;
});
LazyCollapse.displayName = 'LazyCollapse';

/**
 * Hook for managing lazy collapse state externally
 * Useful when you need more control over the lazy loading behavior
 *
 * Usage:
 * ```tsx
 * const { renderedPanels, markAsRendered, shouldRender } = useLazyCollapse();
 *
 * <Collapse
 *   onChange={(keys) => {
 *     if (Array.isArray(keys)) {
 *       keys.forEach(markAsRendered);
 *     }
 *   }}
 *   items={[
 *     {
 *       key: '1',
 *       label: 'Panel 1',
 *       children: shouldRender('1') ? <ExpensiveComponent /> : null,
 *     },
 *   ]}
 * />
 * ```
 */
export const useLazyCollapse = () => {
  const [renderedPanels, setRenderedPanels] = useState<Set<string | number>>(new Set());

  const markAsRendered = useCallback((key: string | number) => {
    setRenderedPanels((prev) => {
      if (prev.has(key)) return prev;
      return new Set(prev).add(key);
    });
  }, []);

  const shouldRender = useCallback(
    (key: string | number) => {
      return renderedPanels.has(key);
    },
    [renderedPanels],
  );

  const reset = useCallback(() => {
    setRenderedPanels(new Set());
  }, []);

  return {
    renderedPanels,
    markAsRendered,
    shouldRender,
    reset,
  };
};
