import { FC, memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Tooltip, Button, message, Modal } from 'antd';
import { CanvasNodeType } from '@refly/openapi-schema';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import {
  IconDeleteFile,
  IconVariable,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import {
  AiChat,
  Reload,
  Copy,
  Clone,
  More,
  Delete,
  Download,
  PlayOutline,
  AddContext,
} from 'refly-icons';
import cn from 'classnames';
import { useReactFlow, useStore } from '@xyflow/react';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { useGetNodeContent } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-content';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useCanvasStoreShallow } from '@refly/stores';
import { useShallow } from 'zustand/react/shallow';
import CommonColorPicker from './color-picker';
import { logEvent } from '@refly/telemetry-web';

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
  disabled?: boolean;
};

type NodeActionButtonsProps = {
  nodeId: string;
  nodeType: CanvasNodeType;
  isNodeHovered: boolean;
  isSelected?: boolean;
  bgColor?: string;
  onChangeBackground?: (bgColor: string) => void;
  isExtracting?: boolean;
};

export const NodeActionButtons: FC<NodeActionButtonsProps> = memo(
  ({ nodeId, nodeType, isNodeHovered, bgColor, onChangeBackground, isExtracting }) => {
    const { t } = useTranslation();
    const { readonly, canvasId, workflowRun } = useCanvasContext();
    const { getNode } = useReactFlow();
    const node = useMemo(() => getNode(nodeId), [nodeId, getNode]);
    const { fetchNodeContent } = useGetNodeContent(node);
    const nodeData = useMemo(() => node?.data, [node]);
    const buttonContainerRef = useRef<HTMLDivElement>(null);

    // Shared workflow state from CanvasProvider
    const initializing = workflowRun?.loading ?? false;
    const isPolling = workflowRun?.isPolling ?? false;

    const showMoreButton = useMemo(() => {
      return !['skill', 'mediaSkill', 'mediaSkillResponse', 'video', 'audio', 'image'].includes(
        nodeType,
      );
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

    const { activeExecutionId } = useCanvasStoreShallow((state) => ({
      activeExecutionId: canvasId ? (state.canvasExecutionId[canvasId] ?? null) : null,
    }));
    const isRunningWorkflow = useMemo(
      () => !!(initializing || isPolling || activeExecutionId),
      [initializing, isPolling, activeExecutionId],
    );
    const [cloneAskAIRunning, setCloneAskAIRunning] = useState(false);
    const [copyRunning, setCopyRunning] = useState(false);
    const [downloadRunning, setDownloadRunning] = useState(false);

    const shouldShowButtons =
      !readonly &&
      !isMultiSelected &&
      (isNodeHovered || contextMenuOpenedCanvasId === nodeId || !!isExtracting);

    const handleCloneAskAI = useCallback(() => {
      setCloneAskAIRunning(true);

      nodeActionEmitter.on(createNodeEventName(nodeId, 'cloneAskAI.completed'), () => {
        setCloneAskAIRunning(false);
        nodeActionEmitter.off(createNodeEventName(nodeId, 'cloneAskAI.completed'));
      });

      nodeActionEmitter.emit(createNodeEventName(nodeId, 'cloneAskAI'));
    }, [nodeId, t, nodeActionEmitter]);

    const handleAddToContext = useCallback(() => {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'addToContext'));
    }, [nodeId, nodeActionEmitter]);

    const handleCopy = useCallback(async () => {
      setCopyRunning(true);
      if (nodeType === 'skillResponse') {
        logEvent('copy_node_content_ask_ai', null, {
          canvasId,
          nodeId,
        });
      }

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
    }, [fetchNodeContent, t, nodeType, canvasId, nodeId]);

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

    const handleDownload = useCallback(() => {
      setDownloadRunning(true);
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'download'));
    }, [nodeId]);

    const handleRunWorkflow = useCallback(() => {
      if (!canvasId || isRunningWorkflow) return;
      logEvent('run_from_this_node', null, {
        canvasId,
        nodeId,
      });

      workflowRun?.initialize?.([nodeId]);
    }, [canvasId, nodeId, isRunningWorkflow, workflowRun]);

    const actionButtons = useMemo(() => {
      const buttons: ActionButtonType[] = [];

      // Add askAI button for most node types except skill, mediaSkill, mediaSkillResponse, audio, video
      if (!['skill', 'mediaSkill', 'mediaSkillResponse', 'audio', 'video'].includes(nodeType)) {
        buttons.push({
          key: 'askAI',
          icon: AiChat,
          color: 'var(--refly-primary-default)',
          tooltip: t('canvas.nodeActions.askAI'),
          onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'askAI')),
        });
      }

      if (
        [
          'skillResponse',
          'document',
          'resource',
          'codeArtifact',
          'website',
          'image',
          'video',
          'audio',
          'memo',
        ].includes(nodeType)
      ) {
        buttons.push({
          key: 'addToContext',
          icon: AddContext,
          tooltip: t('canvas.nodeActions.addToContext'),
          onClick: handleAddToContext,
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
            key: 'rouWorkflow',
            icon: PlayOutline,
            tooltip: t(
              `canvas.nodeActions.${isRunningWorkflow ? 'existWorkflowRunning' : 'runWorkflow'}`,
            ),
            onClick: handleRunWorkflow,
            disabled: isRunningWorkflow,
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
            key: 'variable',
            icon: IconVariable,
            tooltip: t('canvas.nodeActions.extractVariables' as any) || t('canvas.nodeActions.run'),
            onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'extractVariables')),
            loading: isExtracting,
          });
          break;

        case 'mediaSkillResponse':
          buttons.push({
            key: 'rerun',
            icon: Reload,
            tooltip: t('canvas.nodeActions.rerun'),
            onClick: () => nodeActionEmitter.emit(createNodeEventName(nodeId, 'rerun')),
          });
          break;

        case 'image':
          buttons.push({
            key: 'download',
            icon: Download,
            tooltip: t('canvas.nodeActions.download'),
            onClick: handleDownload,
            loading: downloadRunning,
          });
          break;

        case 'audio':
          break;

        case 'video':
          break;
      }

      // Add copy button for content nodes
      if (
        [
          'skillResponse',
          'mediaSkillResponse',
          'document',
          'resource',
          'codeArtifact',
          'memo',
        ].includes(nodeType)
      ) {
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
        color: 'var(--refly-func-danger-default)',
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
          color: 'var(--refly-func-danger-default)',
        });
      }

      return buttons;
    }, [
      nodeId,
      nodeType,
      t,
      handleCloneAskAI,
      cloneAskAIRunning,
      handleCopy,
      copyRunning,
      handleDownload,
      downloadRunning,
    ]);

    // Listen download events to control loading state
    useEffect(() => {
      const onStarted = () => setDownloadRunning(true);
      const onCompleted = (payload?: { success?: boolean; fileName?: string }) => {
        setDownloadRunning(false);
        if (payload?.success) {
          message.success(t('canvas.nodeActions.downloadSuccess'));
        } else {
          message.error(t('canvas.nodeActions.downloadError'));
        }
      };

      nodeActionEmitter.on(createNodeEventName(nodeId, 'download.started'), onStarted);
      nodeActionEmitter.on(createNodeEventName(nodeId, 'download.completed'), onCompleted as any);

      return () => {
        nodeActionEmitter.off(createNodeEventName(nodeId, 'download.started'), onStarted);
        nodeActionEmitter.off(
          createNodeEventName(nodeId, 'download.completed'),
          onCompleted as any,
        );
      };
    }, [nodeId, t]);

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
          {' '}
          <div className="flex items-center gap-3">
            {actionButtons.map((button) => (
              <Tooltip key={button.key} title={button.tooltip} placement="top">
                <Button
                  type="text"
                  disabled={button.disabled}
                  danger={button.danger}
                  icon={
                    <button.icon
                      color={
                        button.disabled
                          ? 'var(--refly-text-3)'
                          : button.color || 'var(--refly-text-0)'
                      }
                      size={18}
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
                    'text-refly-text-1 hover:!bg-refly-tertiary-hover': !button.danger,
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
              <Button
                type="text"
                size="small"
                icon={<More size={18} />}
                onClick={handleOpenContextMenu}
                className="h-6 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover"
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);
