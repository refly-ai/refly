import { FC, memo, useMemo, useState, useCallback, useRef } from 'react';
import { Tooltip, Button, message, Modal } from 'antd';
import { CanvasNodeType } from '@refly/openapi-schema';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import {
  IconDeleteFile,
  IconRun,
  IconPreview,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { AiChat, Reload, Copy, Clone, More, Delete } from 'refly-icons';
import cn from 'classnames';
import { useReactFlow, useStore } from '@xyflow/react';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { useGetNodeContent } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-content';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useCanvasStoreShallow } from '@refly/stores';
import { useShallow } from 'zustand/react/shallow';
import CommonColorPicker from './color-picker';

type ActionButtonType = {
  key: string;
  icon: React.ComponentType<any>;
  tooltip: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
  color?: string;
  bgColor?: string;
  onChangeBackground?: (bgColor: string) => void;
};

type NodeActionButtonsProps = {
  nodeId: string;
  nodeType: CanvasNodeType;
  isNodeHovered: boolean;
  isSelected?: boolean;
  bgColor?: string;
  onChangeBackground?: (bgColor: string) => void;
};

export const NodeActionButtons: FC<NodeActionButtonsProps> = memo(
  ({ nodeId, nodeType, isNodeHovered, bgColor, onChangeBackground }) => {
    const { t } = useTranslation();
    const { readonly } = useCanvasContext();
    const { getNode } = useReactFlow();
    const node = useMemo(() => getNode(nodeId), [nodeId, getNode]);
    const { fetchNodeContent } = useGetNodeContent(node);
    const nodeData = useMemo(() => node?.data, [node]);
    const buttonContainerRef = useRef<HTMLDivElement>(null);

    const showMoreButton = useMemo(() => {
      return !['skill', 'mediaSkill', 'video', 'audio', 'image'].includes(nodeType);
    }, [nodeType]);

    const { nodes } = useStore(
      useShallow((state) => ({
        nodes: state.nodes,
        edges: state.edges,
      })),
    );

    const selectedNodes = nodes.filter((node) => node.selected) || [];
    const isMultiSelected = selectedNodes.length > 1;

    const { contextMenuOpenedCanvasId } = useCanvasStoreShallow((state) => ({
      contextMenuOpenedCanvasId: state.contextMenuOpenedCanvasId,
    }));

    const [cloneAskAIRunning, setCloneAskAIRunning] = useState(false);
    const [copyRunning, setCopyRunning] = useState(false);

    const shouldShowButtons =
      !readonly && !isMultiSelected && (isNodeHovered || contextMenuOpenedCanvasId === nodeId);

    const handleCloneAskAI = useCallback(() => {
      setCloneAskAIRunning(true);

      nodeActionEmitter.on(createNodeEventName(nodeId, 'cloneAskAI.completed'), () => {
        setCloneAskAIRunning(false);
        nodeActionEmitter.off(createNodeEventName(nodeId, 'cloneAskAI.completed'));
      });

      nodeActionEmitter.emit(createNodeEventName(nodeId, 'cloneAskAI'));
    }, [nodeId, t, nodeActionEmitter]);

    const handleCopy = useCallback(async () => {
      setCopyRunning(true);
      try {
        const content = (await fetchNodeContent()) as string;
        copyToClipboard(content || '');
        message.success(t('copilot.message.copySuccess'));
      } catch (error) {
        console.error('Failed to copy content:', error);
        message.error(t('copilot.message.copyFailed'));
      } finally {
        setCopyRunning(false);
      }
    }, [fetchNodeContent, t]);

    const handleDeleteFile = useCallback(
      (type: 'resource' | 'document') => {
        Modal.confirm({
          centered: true,
          title: t('common.deleteConfirmMessage'),
          content: t(`canvas.nodeActions.${type}DeleteConfirm`, {
            title: nodeData?.title || t('common.untitled'),
          }),
          okText: t('common.delete'),
          cancelButtonProps: {
            className: 'hover:!border-[#0E9F77] hover:!text-[#0E9F77] ',
          },
          cancelText: t('common.cancel'),
          okButtonProps: { danger: true },
          onOk: () => {
            nodeActionEmitter.emit(createNodeEventName(nodeId, 'deleteFile'));
          },
        });
      },
      [nodeId, t],
    );

    const handleOpenContextMenu = useCallback(
      (e: React.MouseEvent) => {
        // Prevent the event from bubbling up
        e.stopPropagation();
        e.preventDefault();

        // Get the button position
        const buttonRect = buttonContainerRef.current?.getBoundingClientRect();

        // Calculate a position just to the right of the button
        const x = buttonRect.right;
        const y = buttonRect.top;

        // Emit an event that the Canvas component can listen to
        // Note: We're using 'as any' to bypass TypeScript checking
        // since the Canvas component expects an originalEvent property
        nodeOperationsEmitter.emit('openNodeContextMenu', {
          nodeId,
          nodeType,
          x: x,
          y: y,
          originalEvent: e,
        } as any);
      },
      [nodeId, nodeType],
    );

    const actionButtons = useMemo(() => {
      const buttons: ActionButtonType[] = [];

      // Add askAI button for most node types except skill, mediaSkill, audio, video
      if (!['skill', 'mediaSkill', 'audio', 'video'].includes(nodeType)) {
        buttons.push({
          key: 'askAI',
          icon: AiChat,
          color: 'var(--refly-primary-default)',
          tooltip: t('canvas.nodeActions.askAI'),
          onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'askAI')),
        });
      }

      // Add type-specific buttons
      switch (nodeType) {
        case 'skillResponse':
          buttons.push({
            key: 'rerun',
            icon: Reload,
            tooltip: t('canvas.nodeActions.rerun'),
            onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'rerun')),
          });

          buttons.push({
            key: 'cloneAskAI',
            icon: Clone,
            tooltip: t('canvas.nodeActions.cloneAskAI'),
            onClick: handleCloneAskAI,
            loading: cloneAskAIRunning,
          });
          break;

        case 'skill':
          buttons.push({
            key: 'run',
            icon: IconRun,
            tooltip: t('canvas.nodeActions.run'),
            onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'run')),
          });
          break;

        case 'image':
          buttons.push({
            key: 'preview',
            icon: IconPreview,
            tooltip: t('canvas.nodeActions.preview'),
            onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'preview')),
          });
          break;
      }

      // Add copy button for content nodes
      if (['skillResponse', 'document', 'resource', 'codeArtifact', 'memo'].includes(nodeType)) {
        buttons.push({
          key: 'copy',
          icon: Copy,
          tooltip: t('canvas.nodeActions.copy'),
          onClick: handleCopy,
          loading: copyRunning,
        });
      }

      // Add delete button for all node types
      buttons.push({
        key: 'delete',
        icon: Delete,
        tooltip: t('canvas.nodeActions.delete'),
        onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'delete')),
        danger: true,
      });

      if (['resource', 'document'].includes(nodeType)) {
        buttons.push({
          key: 'deleteFile',
          icon: IconDeleteFile,
          tooltip:
            nodeType === 'document'
              ? t('canvas.nodeActions.deleteDocument')
              : t('canvas.nodeActions.deleteResource'),
          onClick: () => handleDeleteFile(nodeType as 'document' | 'resource'),
          danger: true,
        });
      }

      return buttons;
    }, [nodeId, nodeType, t, handleCloneAskAI, cloneAskAIRunning, handleCopy, copyRunning]);

    if (!shouldShowButtons) return null;

    return (
      <div
        className={cn(
          '-top-11 -left-1 -right-1 -bottom-1 -z-1 rounded-[20px] bg-refly-bg-control-z0 border-[1px] border-solid border-refly-Card-Border absolute gap-1 shadow-refly-m transition-opacity duration-200',
          {
            'opacity-100': shouldShowButtons,
            'opacity-0 pointer-events-none': !shouldShowButtons,
          },
        )}
        ref={buttonContainerRef}
      >
        <div
          className={cn('flex items-center justify-between pt-3 pb-2 px-3', {
            '!justify-end': !showMoreButton,
          })}
        >
          <div className="flex items-center gap-3">
            {actionButtons.map((button) => (
              <Tooltip key={button.key} title={button.tooltip} placement="top">
                <Button
                  type="text"
                  danger={button.danger}
                  icon={<button.icon color={button.color} size={18} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    button.onClick();
                  }}
                  size="small"
                  loading={button.loading}
                  className={cn('h-6 p-0 flex items-center justify-center', {
                    'text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100':
                      !button.danger,
                  })}
                />
              </Tooltip>
            ))}
          </div>

          {showMoreButton && (
            <div className="flex items-center gap-2">
              {nodeType === 'memo' && (
                <CommonColorPicker color={bgColor} onChange={onChangeBackground} />
              )}
              <Tooltip title={t('canvas.nodeActions.more')} placement="top">
                <Button
                  type="text"
                  size="small"
                  icon={<More size={18} />}
                  onClick={handleOpenContextMenu}
                  className="h-6 p-0 flex items-center justify-center"
                />
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    );
  },
);
