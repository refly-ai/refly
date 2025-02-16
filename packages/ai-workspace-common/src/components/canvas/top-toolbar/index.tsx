import { useEffect, FC, useState, useCallback, memo } from 'react';
import { Button, Divider, Tooltip, Skeleton, Popover } from 'antd';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { useDebounce } from 'use-debounce';
import { useDebouncedCallback } from 'use-debounce';
import { MdOutlineImage, MdOutlineAspectRatio } from 'react-icons/md';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
import { BiErrorCircle } from 'react-icons/bi';
import { IconEdit, IconSearch } from '@refly-packages/ai-workspace-common/components/common/icon';
import SiderPopover from '../../../../../../apps/web/src/pages/sider-popover';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { Helmet } from 'react-helmet';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { useCanvasSync } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-sync';
import { NodeSelector } from '../common/node-selector';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useReactFlow } from '@xyflow/react';
import { CanvasRename } from './canvas-rename';
import { HoverCard } from '@refly-packages/ai-workspace-common/components/hover-card';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import { useHoverCard } from '@refly-packages/ai-workspace-common/hooks/use-hover-card';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

interface TopToolbarProps {
  canvasId: string;
}

const CanvasTitle = memo(
  ({
    canvasId,
    canvasTitle,
    hasCanvasSynced,
    debouncedUnsyncedChanges,
    language,
  }: {
    canvasId: string;
    canvasTitle?: string;
    hasCanvasSynced: boolean;
    debouncedUnsyncedChanges: number;
    language: LOCALE;
  }) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { syncTitleToYDoc } = useCanvasSync();
    const { updateCanvasTitle } = useSiderStoreShallow((state) => ({
      updateCanvasTitle: state.updateCanvasTitle,
    }));

    const handleEditClick = useCallback(() => {
      setIsModalOpen(true);
    }, []);

    const handleModalOk = useCallback(
      (newTitle: string) => {
        if (newTitle?.trim()) {
          syncTitleToYDoc(newTitle);
          updateCanvasTitle(canvasId, newTitle);
          setIsModalOpen(false);
        }
      },
      [canvasId, syncTitleToYDoc, updateCanvasTitle],
    );

    const handleModalCancel = useCallback(() => {
      setIsModalOpen(false);
    }, []);

    const { getCanvasList } = useHandleSiderData();
    const debouncedRefetchCanvasList = useDebouncedCallback(async () => {
      await getCanvasList();
    }, 500);

    // Refetch canvas list when canvas title changes
    useEffect(() => {
      debouncedRefetchCanvasList();
    }, [canvasTitle]);

    return (
      <>
        <div
          className="ml-1 group flex items-center gap-2 text-sm font-bold text-gray-500 cursor-pointer hover:text-gray-700"
          onClick={handleEditClick}
          data-cy="canvas-title-edit"
        >
          <Tooltip
            title={
              debouncedUnsyncedChanges > 0
                ? t('canvas.toolbar.syncingChanges')
                : t('canvas.toolbar.synced', {
                    time: time(new Date(), language)?.utc()?.fromNow(),
                  })
            }
          >
            <div
              className={`
              relative w-2.5 h-2.5 rounded-full
              transition-colors duration-700 ease-in-out
              ${debouncedUnsyncedChanges > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-400'}
            `}
            />
          </Tooltip>
          {!hasCanvasSynced ? (
            <Skeleton className="w-28" active paragraph={false} />
          ) : (
            canvasTitle || t('common.untitled')
          )}
          <IconEdit />
        </div>

        <CanvasRename
          canvasId={canvasId}
          canvasTitle={canvasTitle}
          isModalOpen={isModalOpen}
          handleModalOk={handleModalOk}
          handleModalCancel={handleModalCancel}
        />
      </>
    );
  },
);

const ToolbarButtons = memo(
  ({
    showPreview,
    showMaxRatio,
    setShowPreview,
    setShowMaxRatio,
  }: {
    showPreview: boolean;
    showMaxRatio: boolean;
    setShowPreview: (show: boolean) => void;
    setShowMaxRatio: (show: boolean) => void;
  }) => {
    const { t } = useTranslation();
    const [searchOpen, setSearchOpen] = useState(false);
    const { setNodeCenter } = useNodePosition();
    const { getNodes } = useReactFlow();
    const { hoverCardEnabled } = useHoverCard();

    const handleNodeSelect = useCallback(
      (item: IContextItem) => {
        const nodes = getNodes();
        const node = nodes.find((n) => n.data?.entityId === item.entityId);
        if (node) {
          setNodeCenter(node.id, true);
          // setSearchOpen(false);
        }
      },
      [getNodes, setNodeCenter],
    );

    const previewButtonConfig = {
      title: t(`canvas.toolbar.${showPreview ? 'hidePreview' : 'showPreview'}`),
      description: t('canvas.toolbar.togglePreviewDescription'),
      videoUrl: 'https://static.refly.ai/onboarding/top-toolbar/topToolbar-togglePreview.webm',
      placement: 'bottom' as const,
    };

    const maxRatioButtonConfig = {
      title: t(`canvas.toolbar.${showMaxRatio ? 'hideMaxRatio' : 'showMaxRatio'}`),
      description: t('canvas.toolbar.toggleMaxRatioDescription'),
      videoUrl: 'https://static.refly.ai/onboarding/top-toolbar/topToolbar-toogleMaxRatio.webm',
      placement: 'bottom' as const,
    };

    const previewButton = (
      <Button
        type="text"
        icon={<MdOutlineImage style={{ color: showPreview ? '#000' : '#9CA3AF' }} />}
        onClick={() => setShowPreview(!showPreview)}
        className="w-8 h-6 flex items-center justify-center mr-1"
      />
    );

    const maxRatioButton = (
      <Button
        type="text"
        icon={<MdOutlineAspectRatio style={{ color: showMaxRatio ? '#000' : '#9CA3AF' }} />}
        onClick={() => setShowMaxRatio(!showMaxRatio)}
        className="w-8 h-6 flex items-center justify-center"
      />
    );

    return (
      <div className="flex items-center h-9 bg-[#ffffff] rounded-lg px-2 border border-solid border-1 border-[#EAECF0] box-shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)]">
        <Popover
          open={searchOpen}
          onOpenChange={setSearchOpen}
          overlayInnerStyle={{ padding: 0, boxShadow: 'none' }}
          trigger="click"
          placement="bottomRight"
          content={
            <NodeSelector
              onSelect={handleNodeSelect}
              showFooterActions={true}
              onClickOutside={() => setSearchOpen(false)}
            />
          }
          overlayClassName="node-search-popover"
        >
          <Tooltip title={t('canvas.toolbar.searchNode')}>
            <Button
              type="text"
              icon={<IconSearch style={{ color: '#000' }} />}
              className="w-8 h-6 flex items-center justify-center mr-1"
            />
          </Tooltip>
        </Popover>

        {hoverCardEnabled ? (
          <HoverCard {...previewButtonConfig}>{previewButton}</HoverCard>
        ) : (
          <Tooltip title={previewButtonConfig.title}>{previewButton}</Tooltip>
        )}

        {hoverCardEnabled ? (
          <HoverCard {...maxRatioButtonConfig}>{maxRatioButton}</HoverCard>
        ) : (
          <Tooltip title={maxRatioButtonConfig.title}>{maxRatioButton}</Tooltip>
        )}
      </div>
    );
  },
);

const WarningButton = memo(({ show }: { show: boolean }) => {
  const { t } = useTranslation();

  if (!show) return null;

  return (
    <Tooltip title={t('canvas.connectionTimeout.extra')}>
      <Button
        type="text"
        danger
        icon={<BiErrorCircle style={{ fontSize: '16px' }} />}
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 ml-2 text-red-500 hover:text-red-600"
      >
        {t('canvas.connectionTimeout.title')}
      </Button>
    </Tooltip>
  );
});

export const TopToolbar: FC<TopToolbarProps> = memo(({ canvasId }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.language as LOCALE;

  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  const { provider } = useCanvasContext();
  const [unsyncedChanges, setUnsyncedChanges] = useState(provider?.unsyncedChanges || 0);
  const [debouncedUnsyncedChanges] = useDebounce(unsyncedChanges, 500);

  const handleUnsyncedChanges = useCallback((data: number) => {
    setUnsyncedChanges(data);
  }, []);

  useEffect(() => {
    provider.on('unsyncedChanges', handleUnsyncedChanges);
    return () => {
      provider.off('unsyncedChanges', handleUnsyncedChanges);
    };
  }, [provider, handleUnsyncedChanges]);

  const { data, config, showPreview, setShowPreview, showMaxRatio, setShowMaxRatio } =
    useCanvasStoreShallow((state) => ({
      data: state.data[canvasId],
      config: state.config[canvasId],
      showPreview: state.showPreview,
      setShowPreview: state.setShowPreview,
      showMaxRatio: state.showMaxRatio,
      setShowMaxRatio: state.setShowMaxRatio,
    }));

  const [connectionTimeout, setConnectionTimeout] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (provider?.status !== 'connected') {
      timeoutId = setTimeout(() => {
        setConnectionTimeout(true);
      }, 10000);
    } else {
      setConnectionTimeout(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [provider?.status]);

  const canvasTitle = data?.title;
  const hasCanvasSynced = config?.localSyncedAt > 0 && config?.remoteSyncedAt > 0;
  const showWarning = connectionTimeout && !hasCanvasSynced && provider.status !== 'connected';

  return (
    <>
      <Helmet>
        <title>{canvasTitle?.toString() || t('common.untitled')} · Refly</title>
      </Helmet>
      <div
        className={`absolute h-16 top-0 left-0 right-0  box-border flex justify-between items-center py-2 px-4 pr-0 bg-transparent ${
          collapse ? 'w-[calc(100vw-12px)]' : 'w-[calc(100vw-232px)]'
        }`}
      >
        <div className="flex items-center relative z-10">
          {collapse && (
            <>
              <SiderPopover>
                <Button
                  type="text"
                  icon={<AiOutlineMenuUnfold size={16} className="text-gray-500" />}
                  onClick={() => {
                    setCollapse(!collapse);
                  }}
                />
              </SiderPopover>
              <Divider type="vertical" className="pr-[4px] h-4" />
            </>
          )}
          <CanvasTitle
            canvasId={canvasId}
            canvasTitle={canvasTitle}
            hasCanvasSynced={hasCanvasSynced}
            debouncedUnsyncedChanges={debouncedUnsyncedChanges}
            language={language}
          />
          <WarningButton show={showWarning} />
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <ToolbarButtons
            showPreview={showPreview}
            showMaxRatio={showMaxRatio}
            setShowPreview={setShowPreview}
            setShowMaxRatio={setShowMaxRatio}
          />

          <CanvasActionDropdown canvasId={canvasId} canvasName={canvasTitle} btnSize="large" />
        </div>
      </div>
    </>
  );
});
