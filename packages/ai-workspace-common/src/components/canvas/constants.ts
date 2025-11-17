import { useCanvasStoreShallow } from '@refly/stores';
import { useMemo } from 'react';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useThemeStoreShallow } from '@refly/stores';

export const useEdgeStyles = () => {
  const { readonly } = useCanvasContext();
  const showEdges = useCanvasStoreShallow((state) => state.showEdges);
  const { isDarkMode } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
  }));

  return useMemo(
    () => ({
      default: {
        stroke: showEdges || readonly ? 'var(--refly-line)' : 'transparent',
        strokeWidth: 1.5,
        strokeDasharray: '6 6',
        transition: 'stroke 0.2s, stroke-width 0.2s',
      },
      hover: {
        stroke: 'var(--refly-primary-default)',
        strokeWidth: 1.5,
        transition: 'stroke 0.2s, stroke-width 0.2s',
      },
      selected: {
        stroke: 'var(--refly-primary-default)',
        strokeWidth: 1.5,
        transition: 'stroke 0.2s, stroke-width 0.2s',
      },
    }),
    [showEdges, readonly, isDarkMode],
  );
};

export const getEdgeStyles = (showEdges: boolean) => {
  return {
    default: {
      stroke: showEdges ? 'var(--refly-line)' : 'transparent',
      strokeWidth: 1.5,
      transition: 'stroke 0.2s, stroke-width 0.2s',
    },
  };
};
