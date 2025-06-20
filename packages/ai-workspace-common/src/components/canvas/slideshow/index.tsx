import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import SlideHeader from './slide-header';
import NewSlide from './new-slide';
import { SlideshowEdit } from '../../../../../../apps/web/src/pages/pages';
import { slideshowEmitter } from '@refly-packages/ai-workspace-common/events/slideshow';

import './index.scss';

export const Slideshow = memo(({ canvasId }: { canvasId: string }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  const { setShowSlideshow, canvasPage } = useCanvasStoreShallow((state) => ({
    setShowSlideshow: state.setShowSlideshow,
    canvasPage: state.canvasPage,
  }));

  const [pageId, setPageId] = useState<string | null>(canvasPage[canvasId] || null);

  const containerStyles = useMemo(
    () => ({
      height: '100%',
      width: isMaximized ? 'calc(100vw)' : '840px',
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
    [isMaximized],
  );

  const containerClassName = useMemo(
    () => `
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

  const handleCreatePage = useCallback((pageId: string) => {
    setPageId(pageId);
  }, []);

  useEffect(() => {
    setShowMinimap(isMaximized);
  }, [isMaximized]);

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
    <div className="h-full border border-solid border-gray-100 rounded-lg bg-transparent dark:border-gray-800">
      <div className={containerClassName} style={containerStyles}>
        <SlideHeader
          isMaximized={isMaximized}
          onClose={() => setShowSlideshow(false)}
          onMaximize={() => setIsMaximized(!isMaximized)}
        />
        {pageId ? (
          <SlideshowEdit
            pageId={pageId}
            showMinimap={showMinimap}
            setShowMinimap={setShowMinimap}
            source="slideshow"
            minimalMode={false}
          />
        ) : (
          <NewSlide canvasId={canvasId} afterCreate={handleCreatePage} />
        )}
      </div>
    </div>
  );
});

Slideshow.displayName = 'Slideshow';
