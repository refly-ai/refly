import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useCanvasStoreShallow } from '@refly/stores';
import SlideHeader from './slide-header';
import NewSlide from './new-slide';
import { SlideshowEdit } from '@refly-packages/ai-workspace-common/components/slideshow';
import { slideshowEmitter } from '@refly-packages/ai-workspace-common/events/slideshow';

import './index.scss';

export const Slideshow = memo(({ canvasId }: { canvasId: string }) => {
  // const pageId = 'page-oxlsifqiaw7d2bs3kstci94w';

  const [isMaximized, setIsMaximized] = useState(false);
  const [isWideMode, setIsWideMode] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  const { setShowSlideshow, canvasPage } = useCanvasStoreShallow((state) => ({
    setShowSlideshow: state.setShowSlideshow,
    canvasPage: state.canvasPage,
  }));

  const [pageId, setPageId] = useState<string | null>(canvasPage[canvasId] || null);

  const containerStyles = useMemo(
    () => ({
      height: isMaximized ? 'var(--screen-height)' : 'calc(var(--screen-height) - 92px)',
      width: isMaximized ? 'calc(100vw)' : isWideMode ? '840px' : '420px',
      position: isMaximized ? ('fixed' as const) : ('relative' as const),
      top: isMaximized ? 0 : null,
      right: isMaximized ? 0 : null,
      zIndex: isMaximized ? 50 : 10,
      transition: isMaximized
        ? 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        : 'all 50ms cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column' as const,
      borderRadius: isMaximized ? 0 : '0.5rem',
    }),
    [isMaximized, isWideMode],
  );

  const containerClassName = useMemo(
    () => `
      flex-shrink-0 
      bg-white
      dark:bg-gray-900 
      border 
      border-gray-200
      dark:border-gray-700 
      flex 
      flex-col
      will-change-transform
      ${isMaximized ? 'fixed' : 'rounded-lg'}
    `,
    [isMaximized],
  );

  const outerContainerStyles = useMemo(
    () => ({
      marginLeft: 'auto', // Right-align the container to match NodePreview
    }),
    [],
  );

  const handleCreatePage = useCallback((pageId: string) => {
    setPageId(pageId);
  }, []);

  useEffect(() => {
    setShowMinimap(isMaximized || isWideMode);
  }, [isMaximized, isWideMode]);

  useEffect(() => {
    const handleUpdate = (data: { canvasId: string; pageId: string; entityId: string }) => {
      setPageId(data.pageId);
    };
    slideshowEmitter.on('update', handleUpdate);
    return () => {
      slideshowEmitter.off('update', handleUpdate);
    };
  }, []);

  return (
    <div
      className="border border-solid border-gray-100 rounded-lg bg-transparent dark:border-gray-800"
      style={outerContainerStyles}
    >
      <div className={containerClassName} style={containerStyles}>
        <SlideHeader
          isMaximized={isMaximized}
          isWideMode={isWideMode}
          onClose={() => setShowSlideshow(false)}
          onMaximize={() => setIsMaximized(!isMaximized)}
          onWideMode={() => setIsWideMode(!isWideMode)}
        />
        {pageId ? (
          <SlideshowEdit
            pageId={pageId}
            showMinimap={showMinimap}
            setShowMinimap={setShowMinimap}
            source="slideshow"
            minimalMode={!isMaximized && !isWideMode}
          />
        ) : (
          <NewSlide canvasId={canvasId} afterCreate={handleCreatePage} />
        )}
      </div>
    </div>
  );
});

Slideshow.displayName = 'Slideshow';
