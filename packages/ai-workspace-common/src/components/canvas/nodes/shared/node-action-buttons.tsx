import { FC, memo, useMemo, useState, useCallback, useRef } from 'react';
import { Tooltip, Button, message, Modal } from 'antd';
import { CanvasNodeType } from '@refly/openapi-schema';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import {
  IconDelete,
  IconAskAI,
  IconMoreHorizontal,
  IconCopy,
  IconDeleteFile,
  IconRun,
  IconPreview,
  IconRefresh,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { GrClone } from 'react-icons/gr';
import cn from 'classnames';
import { useReactFlow, useStore } from '@xyflow/react';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { useGetNodeContent } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-content';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useShallow } from 'zustand/react/shallow';

type ActionButtonType = {
  key: string;
  icon: React.ComponentType<any>;
  tooltip: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
};

type NodeActionButtonsProps = {
  nodeId: string;
  nodeType: CanvasNodeType;
  isNodeHovered: boolean;
  isSelected: boolean;
};

export const NodeActionButtons: FC<NodeActionButtonsProps> = memo(
  ({ nodeId, nodeType, isNodeHovered, isSelected }) => {
    const { t } = useTranslation();
    const { readonly } = useCanvasContext();
    const { getNode } = useReactFlow();
    const node = useMemo(() => getNode(nodeId), [nodeId, getNode]);
    const { fetchNodeContent } = useGetNodeContent(node);
    const nodeData = useMemo(() => node?.data, [node]);
    const buttonContainerRef = useRef<HTMLDivElement>(null);

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
      !readonly &&
      !isMultiSelected &&
      (isNodeHovered || isSelected || contextMenuOpenedCanvasId === nodeId);

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
            className: 'hover:!border-[#00968F] hover:!text-[#00968F] ',
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

      // Add askAI button for most node types
      if (!['skill'].includes(nodeType)) {
        buttons.push({
          key: 'askAI',
          icon: IconAskAI,
          tooltip: t('canvas.nodeActions.askAI'),
          onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'askAI')),
        });
      }

      // Add type-specific buttons
      switch (nodeType) {
        case 'skillResponse':
          buttons.push({
            key: 'rerun',
            icon: IconRefresh,
            tooltip: t('canvas.nodeActions.rerun'),
            onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'rerun')),
          });

          buttons.push({
            key: 'cloneAskAI',
            icon: GrClone,
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
          icon: IconCopy,
          tooltip: t('canvas.nodeActions.copy'),
          onClick: handleCopy,
          loading: copyRunning,
        });
      }

      // Add delete button for all node types
      buttons.push({
        key: 'delete',
        icon: IconDelete,
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
          'right-0 -top-8 p-1 flex z-50',
          {
            'opacity-100': shouldShowButtons,
            'opacity-0 pointer-events-none': !shouldShowButtons,
          },
          nodeType === 'memo'
            ? 'block !py-0 gap-0'
            : 'absolute gap-1 bg-white dark:bg-gray-800 rounded-md shadow-md dark:shadow-gray-900 transition-opacity duration-200',
        )}
        ref={buttonContainerRef}
      >
        {actionButtons.map((button) => (
          <Tooltip key={button.key} title={button.tooltip} placement="top">
            <Button
              type="text"
              danger={button.danger}
              icon={
                <button.icon
                  className={cn('w-4 h-4 flex items-center justify-center', {
                    '!w-3.5 !h-3.5': nodeType === 'memo',
                  })}
                />
              }
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
                '!h-8 rounded-none': nodeType === 'memo',
              })}
            />
          </Tooltip>
        ))}

        {nodeType !== 'skill' && (
          <Tooltip title={t('canvas.nodeActions.more')} placement="top">
            <Button
              type="text"
              size="small"
              icon={
                <IconMoreHorizontal
                  className={cn('w-4 h-4 flex items-center justify-center', {
                    '!w-3.5 !h-3.5': nodeType === 'memo',
                  })}
                />
              }
              onClick={handleOpenContextMenu}
              className={cn('h-6 p-0 flex items-center justify-center', {
                '!h-8 rounded-none': nodeType === 'memo',
              })}
            />
          </Tooltip>
        )}
      </div>
    );
  },
);
