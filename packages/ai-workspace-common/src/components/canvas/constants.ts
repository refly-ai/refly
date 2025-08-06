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
        stroke: showEdges || readonly ? (isDarkMode ? '#4b5563' : '#D0D5DD') : 'transparent',
        strokeWidth: 1,
        transition: 'stroke 0.2s, stroke-width 0.2s',
      },
      hover: {
        stroke: '#0E9F77',
        strokeWidth: 2,
        transition: 'stroke 0.2s, stroke-width 0.2s',
      },
      selected: {
        stroke: '#0E9F77',
        strokeWidth: 2,
        transition: 'stroke 0.2s, stroke-width 0.2s',
      },
    }),
    [showEdges],
  );
};

export const getEdgeStyles = (showEdges: boolean, isDarkMode?: boolean) => {
  return {
    default: {
      stroke: showEdges ? (isDarkMode ? '#4b5563' : '#D0D5DD') : 'transparent',
      strokeWidth: 1,
      transition: 'stroke 0.2s, stroke-width 0.2s',
    },
  };
};
