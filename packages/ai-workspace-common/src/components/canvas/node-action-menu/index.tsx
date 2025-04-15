import { Button, Divider, message, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useCallback, useMemo, useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  IconRerun,
  IconDelete,
  IconAskAI,
  IconRun,
  IconPreview,
  IconExpand,
  IconShrink,
  IconCopy,
  IconMemo,
  IconDeleteFile,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { RiFullscreenFill } from 'react-icons/ri';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import {
  FileInput,
  MessageSquareDiff,
  FilePlus,
  Ungroup,
  Group,
  Target,
  Layout,
  Edit,
} from 'lucide-react';
import { GrClone } from 'react-icons/gr';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useUngroupNodes } from '@refly-packages/ai-workspace-common/hooks/canvas/use-batch-nodes-selection/use-ungroup-nodes';
import { useNodeOperations } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-operations';
import { useNodeCluster } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-cluster';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { useCreateMemo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-memo';
import { HoverCard, HoverContent } from '@refly-packages/ai-workspace-common/components/hover-card';
import { useHoverCard } from '@refly-packages/ai-workspace-common/hooks/use-hover-card';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useGetNodeContent } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-content';

interface MenuItem {
  key?: string;
  icon?: React.ElementType;
  label?: string | React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  loading?: boolean;
  danger?: boolean;
  primary?: boolean;
  type?: 'button' | 'divider';
  disabled?: boolean;
  hoverContent?: HoverContent;
}

interface NodeActionMenuProps {
  nodeId: string;
  nodeType: CanvasNodeType;
  onClose?: () => void;
  isProcessing?: boolean;
  isCompleted?: boolean;
  isCreatingDocument?: boolean;
  isMultiSelection?: boolean;
  onHoverCardStateChange?: (isHovered: boolean) => void;
}

export const NodeActionMenu: FC<NodeActionMenuProps> = ({
  nodeId,
  nodeType,
  onClose,
  isMultiSelection,
  onHoverCardStateChange,
}) => {
  const { t } = useTranslation();
  const { getNode } = useReactFlow();
  const { canvasId } = useCanvasContext();
  const { setNodeSizeMode } = useNodeOperations();
  const { setShowPreview } = useCanvasStoreShallow((state) => ({
    setShowPreview: state.setShowPreview,
  }));
  const { previewNode } = useNodePreviewControl({ canvasId });

  const { activeDocumentId } = useDocumentStoreShallow((state) => ({
    activeDocumentId: state.activeDocumentId,
  }));

  const node = useMemo(() => getNode(nodeId) as CanvasNode, [nodeId, getNode]);
  const nodeData = useMemo(() => node?.data, [node]);
  const { fetchNodeContent } = useGetNodeContent(node);
  const [localSizeMode, setLocalSizeMode] = useState(
    () => nodeData?.metadata?.sizeMode || 'adaptive',
  );

  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [cloneAskAIRunning, setCloneAskAIRunning] = useState(false);
  const [beforeCopying, setBeforeCopying] = useState(false);
  const [beforeInserting, setBeforeInserting] = useState(false);
  const [beforeDuplicatingDocument, setBeforeDuplicatingDocument] = useState(false);

  useEffect(() => {
    setLocalSizeMode(nodeData?.metadata?.sizeMode || 'adaptive');
  }, [nodeData?.metadata?.sizeMode]);

  const { nodePreviews, clickToPreview } = useCanvasStoreShallow((state) => ({
    nodePreviews: state.config[canvasId]?.nodePreviews ?? [],
    clickToPreview: state.clickToPreview,
  }));
  const { ungroupNodes } = useUngroupNodes();

  const handleAskAI = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'askAI'));
    onClose?.();
  }, [nodeId, onClose]);

  const handleRun = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'run'));
    onClose?.();
  }, [nodeId, onClose]);

  const handleCloneAskAI = useCallback(() => {
    setCloneAskAIRunning(true);
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'cloneAskAI'));
    nodeActionEmitter.on(createNodeEventName(nodeId, 'cloneAskAI.completed'), () => {
      setCloneAskAIRunning(false);
    });
    onClose?.();
  }, [nodeId, onClose]);

  const handleRerun = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'rerun'));
    onClose?.();
  }, [nodeId, onClose]);

  const handleDelete = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'delete'));
    onClose?.();
  }, [nodeId, onClose]);

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
          onClose?.();
        },
      });
    },
    [nodeId, onClose, nodeData?.title, t],
  );

  const handleAddToContext = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'addToContext'));
    onClose?.();
  }, [nodeId, onClose]);

  const handleCreateDocument = useCallback(() => {
    setIsCreatingDocument(true);
    const closeLoading = message.loading(t('canvas.nodeStatus.isCreatingDocument'));
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'createDocument'));
    nodeActionEmitter.on(createNodeEventName(nodeId, 'createDocument.completed'), () => {
      setIsCreatingDocument(false);
      closeLoading();
    });
    onClose?.();
  }, [nodeId, onClose]);

  const handleInsertToDoc = useCallback(async () => {
    setBeforeInserting(true);
    const content = (await fetchNodeContent()) as string;
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'insertToDoc'), {
      content,
    });
    setBeforeInserting(false);
    onClose?.();
  }, [nodeId, fetchNodeContent, onClose]);

  const handlePreview = useCallback(() => {
    if (nodeType === 'image') {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'preview'));
    } else {
      previewNode(node);
      locateToNodePreviewEmitter.emit('locateToNodePreview', {
        id: nodeId,
        canvasId,
      });
    }
    onClose?.();
  }, [node, nodeId, canvasId, onClose, previewNode]);

  const handleFullScreenPreview = useCallback(() => {
    setShowPreview(true);
    const isPreviewOpen = nodePreviews?.some((preview) => preview.id === nodeId);

    if (!isPreviewOpen) {
      previewNode(node);
    }

    requestAnimationFrame(() => {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'fullScreenPreview'));
    });

    onClose?.();
  }, [node, nodeId, canvasId, onClose, previewNode, nodeType, nodePreviews]);

  const handleUngroup = useCallback(() => {
    ungroupNodes(nodeId);
    onClose?.();
  }, [ungroupNodes, nodeId, onClose]);

  const handleToggleSizeMode = useCallback(() => {
    const newMode = localSizeMode === 'compact' ? 'adaptive' : 'compact';
    setLocalSizeMode(newMode);
    setNodeSizeMode(nodeId, newMode);
    onClose?.();
  }, [nodeId, localSizeMode, setNodeSizeMode, onClose]);

  const { selectNodeCluster, groupNodeCluster, layoutNodeCluster } = useNodeCluster();

  const handleSelectCluster = useCallback(() => {
    if (nodeType === 'group') {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'selectCluster'));
    } else {
      selectNodeCluster(nodeId);
    }
    onClose?.();
  }, [nodeId, nodeType, selectNodeCluster, onClose]);

  const handleGroupCluster = useCallback(() => {
    if (nodeType === 'group') {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'groupCluster'));
    } else {
      groupNodeCluster(nodeId);
    }
    onClose?.();
  }, [nodeId, nodeType, groupNodeCluster, onClose]);

  const handleLayoutCluster = useCallback(() => {
    if (nodeType === 'group') {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'layoutCluster'));
    } else {
      layoutNodeCluster(nodeId);
    }
    onClose?.();
  }, [nodeId, nodeType, layoutNodeCluster, onClose]);

  const handleCopy = useCallback(async () => {
    setBeforeCopying(true);
    const content = (await fetchNodeContent()) as string;
    setBeforeCopying(false);
    copyToClipboard(content || '');
    message.success(t('copilot.message.copySuccess'));
    onClose?.();
  }, [fetchNodeContent, nodeData?.metadata?.imageUrl, onClose, t, nodeType]);

  const handleEditQuery = useCallback(() => {
    previewNode(node);

    setTimeout(() => {
      locateToNodePreviewEmitter.emit('locateToNodePreview', {
        id: nodeId,
        canvasId,
        type: 'editResponse',
      });
    }, 100);

    onClose?.();
  }, [nodeId, canvasId, node, previewNode, onClose]);
  const { createMemo } = useCreateMemo();

  const handleCreateMemo = useCallback(() => {
    createMemo({
      content: '',
      position: undefined,
      sourceNode: {
        type: nodeType,
        entityId: nodeData?.entityId,
      },
    });
    onClose?.();
  }, [nodeData, nodeType, createMemo, onClose]);

  const handleDuplicateDocument = useCallback(async () => {
    setBeforeDuplicatingDocument(true);
    const content = (await fetchNodeContent()) as string;
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'duplicateDocument'), {
      content,
    });
    setBeforeDuplicatingDocument(false);
    onClose?.();
  }, [nodeId, fetchNodeContent, onClose]);

  const getMenuItems = useCallback(
    (activeDocumentId: string): MenuItem[] => {
      if (isMultiSelection) {
        return [
          {
            key: 'askAI',
            icon: IconAskAI,
            label: t('canvas.nodeActions.askAI'),
            onClick: handleAskAI,
            type: 'button' as const,
            primary: true,
            hoverContent: {
              title: t('canvas.nodeActions.askAI'),
              description: t('canvas.nodeActions.askAIDescription'),
              videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-askAI.webm',
            },
          },
          { key: 'divider-1', type: 'divider' } as MenuItem,
          {
            key: 'addToContext',
            icon: MessageSquareDiff,
            label: t('canvas.nodeActions.addToContext'),
            onClick: handleAddToContext,
            type: 'button' as const,
            hoverContent: {
              title: t('canvas.nodeActions.addToContext'),
              description: t('canvas.nodeActions.addToContextDescription'),
              videoUrl:
                'https://static.refly.ai/onboarding/nodeAction/nodeAction-addToContext.webm',
            },
          },
          { key: 'divider-2', type: 'divider' } as MenuItem,
          {
            key: 'delete',
            icon: IconDelete,
            label: t('canvas.nodeActions.delete'),
            onClick: handleDelete,
            danger: true,
            type: 'button' as const,
            hoverContent: {
              title: t('canvas.nodeActions.delete'),
              description: t('canvas.nodeActions.deleteDescription'),
              videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-delete.webm',
            },
          },
        ];
      }

      const commonItems: MenuItem[] = [
        {
          key: 'askAI',
          icon: IconAskAI,
          label: t('canvas.nodeActions.askAI'),
          onClick: handleAskAI,
          type: 'button' as const,
          primary: true,
          hoverContent: {
            title: t('canvas.nodeActions.askAI'),
            description: t('canvas.nodeActions.askAIDescription'),
            videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-askAI.webm',
          },
        },
        ...(nodeType === 'skillResponse'
          ? [
              {
                key: 'cloneAskAI',
                icon: GrClone,
                loading: cloneAskAIRunning,
                label: t('canvas.nodeActions.cloneAskAI'),
                onClick: handleCloneAskAI,
                type: 'button' as const,
                hoverContent: {
                  title: t('canvas.nodeActions.cloneAskAI'),
                  description: t('canvas.nodeActions.cloneAskAIDescription'),
                  videoUrl:
                    'https://static.refly.ai/onboarding/nodeAction/nodeAction-cloneAskAI.webm',
                },
              },
              {
                key: 'editQuery',
                icon: Edit,
                label: t('canvas.nodeActions.editQuery'),
                onClick: handleEditQuery,
                type: 'button' as const,
                hoverContent: {
                  title: t('canvas.nodeActions.editQuery'),
                  description: t('canvas.nodeActions.editQueryDescription'),
                  videoUrl:
                    'https://static.refly.ai/onboarding/nodeAction/nodeAction-editQuery.webm',
                },
              },
              {
                key: 'rerun',
                icon: IconRerun,
                label: t('canvas.nodeActions.rerun'),
                onClick: handleRerun,
                type: 'button' as const,
                hoverContent: {
                  title: t('canvas.nodeActions.rerun'),
                  description: t('canvas.nodeActions.rerunDescription'),
                  videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-rerun.webm',
                },
              },
            ]
          : []),
        {
          key: 'addToContext',
          icon: MessageSquareDiff,
          label: t('canvas.nodeActions.addToContext'),
          onClick: handleAddToContext,
          type: 'button' as const,
          hoverContent: {
            title: t('canvas.nodeActions.addToContext'),
            description: t('canvas.nodeActions.addToContextDescription'),
            videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-addToContext.webm',
          },
        },
      ];

      const operationItems: MenuItem[] = [
        (!clickToPreview || nodeType === 'image') && {
          key: 'preview',
          icon: IconPreview,
          label: t('canvas.nodeActions.preview'),
          onClick: handlePreview,
          type: 'button' as const,
          hoverContent: {
            title: t('canvas.nodeActions.preview'),
            description: t('canvas.nodeActions.previewDescription'),
            videoUrl:
              'https://static.refly.ai/onboarding/nodeAction/nodeActionMenu-openPreview.webm',
          },
        },
        nodeType !== 'image' && {
          key: 'fullScreen',
          icon: RiFullscreenFill,
          label: t('canvas.nodeActions.fullScreen'),
          onClick: handleFullScreenPreview,
          type: 'button' as const,
        },
        nodeType !== 'image' && ({ key: 'divider-1', type: 'divider' } as MenuItem),
        nodeType !== 'image' && {
          key: 'toggleSizeMode',
          icon: localSizeMode === 'compact' ? IconExpand : IconShrink,
          label:
            localSizeMode === 'compact'
              ? t('canvas.nodeActions.adaptiveMode')
              : t('canvas.nodeActions.compactMode'),
          onClick: handleToggleSizeMode,
          type: 'button' as const,
          hoverContent: {
            title:
              localSizeMode === 'compact'
                ? t('canvas.nodeActions.adaptiveMode')
                : t('canvas.nodeActions.compactMode'),
            description:
              localSizeMode === 'compact'
                ? t('canvas.nodeActions.adaptiveModeDescription')
                : t('canvas.nodeActions.compactModeDescription'),
            videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-adaptiveMode.webm',
          },
        },
      ].filter(Boolean);

      const nodeTypeItems: Record<string, MenuItem[]> = {
        document: [],
        resource: [
          {
            key: 'createDocument',
            icon: FilePlus,
            label: t('canvas.nodeStatus.createDocument'),
            onClick: handleCreateDocument,
            loading: isCreatingDocument,
            type: 'button' as const,
            hoverContent: {
              title: t('canvas.nodeStatus.createDocument'),
              description: t('canvas.toolbar.createDocumentDescription'),
              videoUrl:
                'https://static.refly.ai/onboarding/nodeAction/nodeAction-createDocument.webm',
            },
          },
        ],
        image: [],
        memo: [
          {
            key: 'insertToDoc',
            icon: FileInput,
            label: t('canvas.nodeActions.insertToDoc'),
            loading: beforeInserting,
            onClick: handleInsertToDoc,
            type: 'button' as const,
            disabled: !activeDocumentId,
            hoverContent: {
              title: t('canvas.nodeActions.insertToDoc'),
              description: t('canvas.nodeActions.insertToDocDescription'),
              videoUrl:
                'https://static.refly.ai/onboarding/nodeAction/nodeAction-insertDocument.webm',
            },
          },
        ],
        codeArtifact: [
          {
            key: 'insertToDoc',
            icon: FileInput,
            label: t('canvas.nodeActions.insertToDoc'),
            loading: beforeInserting,
            onClick: handleInsertToDoc,
            type: 'button' as const,
            disabled: !activeDocumentId,
            hoverContent: {
              title: t('canvas.nodeActions.insertToDoc'),
              description: t('canvas.nodeActions.insertToDocDescription'),
              videoUrl:
                'https://static.refly.ai/onboarding/nodeAction/nodeAction-insertDocument.webm',
            },
          },
        ],
        website: [],
        group: [
          {
            key: 'ungroup',
            icon: Ungroup,
            label: t('canvas.nodeActions.ungroup'),
            onClick: handleUngroup,
            type: 'button' as const,
            hoverContent: {
              title: t('canvas.nodeActions.ungroup'),
              description: t('canvas.nodeActions.ungroupDescription'),
              videoUrl:
                'https://static.refly.ai/onboarding/selection-node-action/selection-nodeAction-ungroup.webm',
            },
          },
        ],
        skill: [
          {
            key: 'run',
            icon: IconRun,
            label: t('canvas.nodeActions.run'),
            onClick: handleRun,
            type: 'button' as const,
            hoverContent: {
              title: t('canvas.nodeActions.run'),
              description: t('canvas.nodeActions.runDescription'),
              videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-run.webm',
            },
          },
        ],
        skillResponse: [
          {
            key: 'insertToDoc',
            icon: FileInput,
            label: t('canvas.nodeActions.insertToDoc'),
            loading: beforeInserting,
            onClick: handleInsertToDoc,
            type: 'button' as const,
            disabled: !activeDocumentId,
            hoverContent: {
              title: t('canvas.nodeActions.insertToDoc'),
              description: t('canvas.nodeActions.insertToDocDescription'),
              videoUrl:
                'https://static.refly.ai/onboarding/nodeAction/nodeAction-insertDocument.webm',
            },
          },
          nodeData?.contentPreview
            ? {
                key: 'createDocument',
                icon: FilePlus,
                label: t('canvas.nodeStatus.createDocument'),
                onClick: handleCreateDocument,
                loading: isCreatingDocument,
                type: 'button' as const,
                hoverContent: {
                  title: t('canvas.nodeStatus.createDocument'),
                  description: t('canvas.toolbar.createDocumentDescription'),
                  videoUrl:
                    'https://static.refly.ai/onboarding/nodeAction/nodeAction-createDocument.webm',
                },
              }
            : null,
        ].filter(Boolean),
      };

      const footerItems: MenuItem[] = [
        ...(nodeType !== 'skill' && nodeType !== 'group'
          ? [
              ...(nodeType === 'document'
                ? [
                    {
                      key: 'duplicateDocument',
                      icon: GrClone,
                      label: t('canvas.nodeActions.duplicateDocument'),
                      loading: beforeDuplicatingDocument,
                      onClick: handleDuplicateDocument,
                      type: 'button' as const,
                      hoverContent: {
                        title: t('canvas.nodeActions.duplicateDocument'),
                        description: t('canvas.nodeActions.duplicateDocumentDescription'),
                        videoUrl:
                          'https://static.refly.ai/onboarding/nodeAction/nodeAction-duplicateDocument.webm',
                      },
                    },
                  ]
                : []),
              {
                key: 'createMemo',
                icon: IconMemo,
                label: t('canvas.nodeActions.createMemo'),
                onClick: handleCreateMemo,
                type: 'button' as const,
                hoverContent: {
                  title: t('canvas.nodeActions.createMemo'),
                  description: t('canvas.nodeActions.createMemoDescription'),
                  videoUrl:
                    'https://static.refly.ai/onboarding/nodeAction/nodeAction-createEmptyMemo.webm',
                },
              },
              ...(!['image', 'website'].includes(nodeType)
                ? [
                    {
                      key: 'copy',
                      icon: IconCopy,
                      label: t('canvas.nodeActions.copy'),
                      loading: beforeCopying,
                      onClick: handleCopy,
                      type: 'button' as const,
                      hoverContent: {
                        title: t('canvas.nodeActions.copy'),
                        description: t('canvas.nodeActions.copyDescription'),
                        videoUrl:
                          'https://static.refly.ai/onboarding/nodeAction/nodeAction-copyContent.webm',
                      },
                    },
                  ]
                : []),
              { key: 'divider-2', type: 'divider' as const },
            ]
          : []),
        {
          key: 'delete',
          icon: IconDelete,
          label: t('canvas.nodeActions.delete'),
          onClick: handleDelete,
          danger: true,
          type: 'button' as const,
          hoverContent: {
            title: t('canvas.nodeActions.delete'),
            description: t('canvas.nodeActions.deleteDescription'),
            videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-delete.webm',
          },
        },
        ...(nodeType === 'document'
          ? [
              {
                key: 'deleteDocument',
                icon: IconDeleteFile,
                label: t('canvas.nodeActions.deleteDocument'),
                onClick: () => handleDeleteFile('document'),
                danger: true,
                type: 'button' as const,
                hoverContent: {
                  title: t('canvas.nodeActions.deleteDocument'),
                  description: t('canvas.nodeActions.deleteDocumentDescription'),
                  videoUrl: 'https://static.refly.ai/static/refly-docs.mp4',
                },
              },
            ]
          : []),
        ...(nodeType === 'resource'
          ? [
              {
                key: 'deleteResource',
                icon: IconDeleteFile,
                label: t('canvas.nodeActions.deleteResource'),
                onClick: () => handleDeleteFile('resource'),
                danger: true,
                type: 'button' as const,
                hoverContent: {
                  title: t('canvas.nodeActions.deleteResource'),
                  description: t('canvas.nodeActions.deleteResourceDescription'),
                  videoUrl: 'https://static.refly.ai/static/refly-docs.mp4',
                },
              },
            ]
          : []),
      ];

      const clusterItems: MenuItem[] = [
        { key: 'divider-cluster', type: 'divider' as const } as MenuItem,
        {
          key: 'selectCluster',
          icon: Target,
          label: t('canvas.nodeActions.selectCluster'),
          onClick: handleSelectCluster,
          type: 'button' as const,
          hoverContent: {
            title: t('canvas.nodeActions.selectCluster'),
            description: t('canvas.nodeActions.selectClusterDescription'),
            videoUrl:
              'https://static.refly.ai/onboarding/nodeAction/nodeAction-selectOrLayout.webm',
          },
        },
        {
          key: 'groupCluster',
          icon: Group,
          label: t('canvas.nodeActions.groupCluster'),
          onClick: handleGroupCluster,
          type: 'button' as const,
          hoverContent: {
            title: t('canvas.nodeActions.groupCluster'),
            description: t('canvas.nodeActions.groupClusterDescription'),
            videoUrl:
              'https://static.refly.ai/onboarding/nodeAction/nodeAction-groupChildNodes.webm',
          },
        },
        {
          key: 'layoutCluster',
          icon: Layout,
          label: t('canvas.nodeActions.layoutCluster'),
          onClick: handleLayoutCluster,
          type: 'button' as const,
          hoverContent: {
            title: t('canvas.nodeActions.layoutCluster'),
            description: t('canvas.nodeActions.layoutClusterDescription'),
            videoUrl:
              'https://static.refly.ai/onboarding/nodeAction/nodeAction-selectOrLayout.webm',
          },
        },
      ];

      return [
        ...(nodeType !== 'skill' ? commonItems : []),
        ...(!['memo', 'skill', 'group'].includes(nodeType) ? operationItems : []),
        ...(nodeTypeItems[nodeType] || []),
        ...(!['memo', 'skill', 'image'].includes(nodeType) ? clusterItems : []),
        { key: 'divider-3', type: 'divider' } as MenuItem,
        ...footerItems,
      ].filter(Boolean);
    },
    [
      cloneAskAIRunning,
      isCreatingDocument,
      beforeInserting,
      beforeCopying,
      beforeDuplicatingDocument,
      nodeType,
      nodeData?.contentPreview,
      handleRerun,
      handleDelete,
      handleAddToContext,
      handleCreateDocument,
      handlePreview,
      t,
      localSizeMode,
      handleToggleSizeMode,
      handleAskAI,
      handleCloneAskAI,
      handleCreateMemo,
      handleGroupCluster,
      handleLayoutCluster,
      handleRun,
      handleEditQuery,
      handleInsertToDoc,
      handleCopy,
      handleDeleteFile,
      handleSelectCluster,
      handleUngroup,
      isMultiSelection,
      handleDuplicateDocument,
    ],
  );

  const menuItems = useMemo(() => getMenuItems(activeDocumentId), [activeDocumentId, getMenuItems]);

  const { hoverCardEnabled } = useHoverCard();

  return (
    <div className="bg-white rounded-lg shadow-lg p-2 w-[200px] border border-[rgba(0,0,0,0.06)]">
      {menuItems.map((item) => {
        if (item?.type === 'divider') {
          return <Divider key={item.key} className="my-1 h-[1px] bg-gray-100" />;
        }

        const button = (
          <Button
            key={item.key}
            className={`
              w-full
              h-8
              flex
              items-center
              gap-2
              px-2
              rounded
              text-sm
              transition-colors
              text-gray-700 hover:bg-gray-50 hover:text-gray-700
              ${item.danger ? '!text-red-600 hover:bg-red-50' : ''}
              ${item.primary ? '!text-primary-600 hover:bg-primary-50' : ''}
              ${item.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            type="text"
            icon={<item.icon className="w-4 h-4 flex items-center justify-center" />}
            loading={item.loading}
            onClick={item.onClick}
            disabled={item.disabled}
          >
            <span className="flex-1 text-left truncate">{item.label}</span>
          </Button>
        );

        if (item.hoverContent && hoverCardEnabled) {
          return (
            <HoverCard
              key={item.key}
              title={item.hoverContent.title}
              description={item.hoverContent.description}
              videoUrl={item.hoverContent.videoUrl}
              placement="right"
              onOpenChange={(open) => onHoverCardStateChange?.(open)}
            >
              {button}
            </HoverCard>
          );
        }

        return button;
      })}
    </div>
  );
};
