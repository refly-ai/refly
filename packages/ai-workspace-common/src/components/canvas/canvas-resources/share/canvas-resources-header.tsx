import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Typography, Input, InputRef } from 'antd';
import { ScreenFull, ScreenDefault } from 'refly-icons';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { TopButtons } from './top-buttons';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { CanvasNodeType } from '@refly/openapi-schema';
import { CanvasNode } from '@refly/canvas-common';

import { AddFromKnowledgeBase } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/add-from-knowledgeBase';

const { Text } = Typography;

interface CanvasResourcesHeaderProps {
  currentResource: CanvasNode | null;
  setCurrentResource: (resource: CanvasNode | null) => void;
}

export const CanvasResourcesHeader = memo((props: CanvasResourcesHeaderProps) => {
  const { currentResource, setCurrentResource } = props;
  const { t } = useTranslation();
  const { readonly } = useCanvasContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleInputRef = useRef<InputRef>(null);

  const { wideScreenVisible, setWideScreenVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      wideScreenVisible: state.wideScreenVisible,
      setWideScreenVisible: state.setWideScreenVisible,
    }),
  );

  const updateNodeTitle = useUpdateNodeTitle();
  const [addFromKnowledgeBaseVisible, setAddFromKnowledgeBaseVisible] = useState(false);

  // Update editing title when activeNode changes
  useEffect(() => {
    if (currentResource?.data?.title) {
      setEditingTitle(currentResource.data.title);
    }
  }, [currentResource?.data?.title]);

  const handleParentClick = useCallback(() => {
    setCurrentResource(undefined);
  }, [setCurrentResource]);

  const handleWideScreen = useCallback(() => {
    setWideScreenVisible(true);
  }, [setWideScreenVisible]);

  const handleExitWideScreen = useCallback(() => {
    setWideScreenVisible(false);
  }, [setWideScreenVisible]);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    if (!currentResource?.data?.entityId || !currentResource?.type) return;

    setIsEditingTitle(true);
    setEditingTitle(currentResource.data.title || '');

    // Focus the input after a short delay to ensure DOM is ready
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 100);
  }, [currentResource?.data?.entityId, currentResource?.type, currentResource?.data?.title]);

  // Handle title save
  const handleTitleSave = useCallback(() => {
    if (!currentResource?.data?.entityId || !currentResource?.type) return;

    const newTitle = editingTitle.trim();
    if (newTitle && newTitle !== currentResource.data.title) {
      updateNodeTitle(
        newTitle,
        currentResource.data.entityId,
        currentResource.id,
        currentResource.type as CanvasNodeType,
      );
    }

    setIsEditingTitle(false);
  }, [currentResource, editingTitle, updateNodeTitle]);

  // Handle title cancel
  const handleTitleCancel = useCallback(() => {
    setIsEditingTitle(false);
    setEditingTitle(currentResource?.data?.title || '');
  }, [currentResource?.data?.title]);

  // Handle key press in title input
  const handleTitleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleTitleSave();
      } else if (e.key === 'Escape') {
        handleTitleCancel();
      }
    },
    [handleTitleSave, handleTitleCancel],
  );

  return (
    <div className="w-full h-[64px] flex-shrink-0 flex gap-2 items-center justify-between p-3 border-solid border-refly-Card-Border border-[1px] border-x-0 border-t-0">
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <Button
          type="text"
          size="small"
          onClick={handleParentClick}
          className={cn(
            'h-[30px] hover:!bg-refly-tertiary-hover',
            wideScreenVisible ? 'pointer-events-none' : '',
            'px-0.5',
          )}
        >
          {t('canvas.resourceLibrary.title')}
        </Button>
        <div className="text-refly-text-2">/</div>
        {isEditingTitle && !readonly ? (
          <Input
            ref={titleInputRef}
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyPress}
            className="min-w-0 flex-1 !max-w-[400px] h-[30px]"
            size="small"
            autoFocus
          />
        ) : (
          <Text
            ellipsis={{ tooltip: true }}
            className={cn(
              'min-w-0 flex-1 !max-w-[400px] leading-5 rounded-lg px-1 py-[5px]',
              readonly ? 'cursor-default' : 'cursor-pointer hover:bg-refly-tertiary-hover',
            )}
            onClick={!readonly ? handleTitleClick : undefined}
          >
            {currentResource?.data?.title || t('common.untitled')}
          </Text>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <TopButtons />

        {currentResource && (
          <Tooltip
            title={t(
              `canvas.resourceLibrary.${wideScreenVisible ? 'exitWideScreen' : 'wideScreen'}`,
            )}
            arrow={false}
          >
            <Button
              className="!h-5 !w-5 p-0"
              size="small"
              type="text"
              icon={wideScreenVisible ? <ScreenDefault size={16} /> : <ScreenFull size={16} />}
              onClick={wideScreenVisible ? handleExitWideScreen : handleWideScreen}
            />
          </Tooltip>
        )}
      </div>
      <AddFromKnowledgeBase
        visible={addFromKnowledgeBaseVisible}
        setVisible={setAddFromKnowledgeBaseVisible}
      />
    </div>
  );
});

CanvasResourcesHeader.displayName = 'CanvasResourcesHeader';
