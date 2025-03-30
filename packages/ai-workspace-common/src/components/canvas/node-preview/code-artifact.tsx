import { useState, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CanvasNode,
  CodeArtifactNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import CodeViewerLayout from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer-layout';
import CodeViewer, {
  detectTypeFromContent,
} from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly-packages/utils/id';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useChatStore } from '@refly-packages/ai-workspace-common/stores/chat';
import { ConfigScope, Skill, CodeArtifactType, CodeArtifact } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { fullscreenEmitter } from '@refly-packages/ai-workspace-common/events/fullscreen';
import { codeArtifactEmitter } from '@refly-packages/ai-workspace-common/events/codeArtifact';
import { useGetCodeArtifactDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useDebouncedCallback } from 'use-debounce';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node';

interface CodeArtifactNodePreviewProps {
  node: CanvasNode<CodeArtifactNodeMeta>;
  artifactId: string;
}

const CodeArtifactNodePreviewComponent = ({ node, artifactId }: CodeArtifactNodePreviewProps) => {
  const { t } = useTranslation();
  const [isShowingCodeViewer, setIsShowingCodeViewer] = useState(true);
  const { addNode } = useAddNode();
  const { readonly: canvasReadOnly } = useCanvasContext();
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const prevContentRef = useRef('');
  const { updateNodeMetadata, syncNodeWithServer } = useNode();

  // Use activeTab from node metadata with fallback to 'code'
  const {
    activeTab = 'code',
    type = 'text/html',
    language = 'html',
    status: nodeStatus,
  } = node.data?.metadata || {};
  const [currentTab, setCurrentTab] = useState<'code' | 'preview'>(activeTab as 'code' | 'preview');
  const [currentType, setCurrentType] = useState<CodeArtifactType>(type as CodeArtifactType);
  // Track status locally to ensure it syncs with node metadata
  const [status, setStatus] = useState(nodeStatus);

  const entityId = node?.data?.entityId ?? '';
  const shareId = node?.data?.metadata?.shareId ?? '';

  // Update local status when node metadata changes
  useEffect(() => {
    if (nodeStatus && nodeStatus !== status) {
      setStatus(nodeStatus);

      // If node metadata shows finished but local state doesn't, update local state
      if (nodeStatus === 'finish' && status === 'generating') {
        setCurrentTab('preview');
      }
    }
  }, [nodeStatus, status, currentTab]);

  // Ensure active tab is in sync with node metadata
  useEffect(() => {
    if (activeTab && activeTab !== currentTab) {
      setCurrentTab(activeTab as 'code' | 'preview');
    }
  }, [activeTab, currentTab]);

  const { data: remoteData, isLoading: isRemoteLoading } = useGetCodeArtifactDetail(
    {
      query: {
        artifactId,
      },
    },
    null,
    { enabled: isLogin && !shareId && artifactId && (!status || status?.startsWith('finish')) },
  );
  const { data: shareData, loading: isShareLoading } = useFetchShareData<CodeArtifact>(shareId);

  const isLoading = isRemoteLoading || isShareLoading;

  const artifactData = useMemo(
    () => shareData || remoteData?.data || null,
    [shareData, remoteData],
  );

  // Use content state with useRef to track previous value - prevents unnecessary re-renders
  const [content, setContent] = useState(artifactData?.content ?? '');

  // Update content and metadata when artifactData changes
  useEffect(() => {
    if (artifactData) {
      // Update content if different
      if (artifactData.content && artifactData.content !== prevContentRef.current) {
        setContent(artifactData.content);
        prevContentRef.current = artifactData.content;
      }

      // Sync with remote data (type, status)
      if (node?.id) {
        const metadataUpdates: Record<string, any> = {};
        let shouldUpdate = false;

        // Update type if different
        if (artifactData.type && artifactData.type !== type) {
          setCurrentType(artifactData.type as CodeArtifactType);
          metadataUpdates.type = artifactData.type;
          shouldUpdate = true;
        }

        // If remote data exists, ensure status is set to 'finish'
        if (status !== 'finish') {
          setStatus('finish');
          metadataUpdates.status = 'finish';
          shouldUpdate = true;
        }

        // Update node metadata if needed
        if (shouldUpdate) {
          updateNodeMetadata(node.id, {
            ...node.data?.metadata,
            ...metadataUpdates,
          });
        }
      }
    }
  }, [artifactData, type, node?.id, updateNodeMetadata, node.data?.metadata, status]);

  useEffect(() => {
    const handleContentUpdate = (data: { artifactId: string; content: string }) => {
      if (data.artifactId === artifactId && data.content !== prevContentRef.current) {
        setContent(data.content);
        prevContentRef.current = data.content;
      }
    };

    const handleStatusUpdate = (data: {
      artifactId: string;
      status: 'finish' | 'generating';
      type?: CodeArtifactType;
    }) => {
      if (data.artifactId === artifactId) {
        // Update local status first for immediate UI feedback
        setStatus(data.status);

        // Update node metadata with new status
        if (node?.id) {
          const metadataUpdates: Record<string, any> = {
            status: data.status,
          };

          // Update tab if status changes to finish
          if (data.status === 'finish') {
            // Always set to preview when finished
            setCurrentTab('preview');
            metadataUpdates.activeTab = 'preview';

            // Sync with server to ensure tab persists across refreshes
            const currentContent = content || prevContentRef.current;
            const typeToUse = data.type || currentType;

            // Use debounce for server sync to avoid too many calls
            if (!canvasReadOnly && artifactId && currentContent) {
              syncNodeWithServer(
                artifactId,
                currentContent,
                typeToUse as CodeArtifactType,
                canvasReadOnly,
              );
            }
          } else if (data.status === 'generating' && currentTab !== 'code') {
            setCurrentTab('code');
            metadataUpdates.activeTab = 'code';
          }

          // Update type if provided and different
          if (data.type && data.type !== currentType) {
            try {
              const detectedType = detectTypeFromContent(data.type);
              setCurrentType(detectedType as CodeArtifactType);
              metadataUpdates.type = detectedType;
            } catch (e) {
              console.error('Error updating type from status update:', e);
            }
          }

          // Apply all metadata updates at once while preserving content
          updateNodeMetadata(node.id, {
            ...node.data?.metadata,
            ...metadataUpdates,
          });

          // If we updated metadata and the status is finish, also update the content in the remote server
          if (data.status === 'finish' && artifactId && !canvasReadOnly) {
            // Ensure we have the latest content
            const currentContent = content || prevContentRef.current;
            if (currentContent) {
              // Update the remote server with the current content and metadata
              syncNodeWithServer(
                artifactId,
                currentContent,
                metadataUpdates.type || (currentType as CodeArtifactType),
                canvasReadOnly,
              );
            }
          }
        }
      }
    };

    codeArtifactEmitter.on('contentUpdate', handleContentUpdate);
    codeArtifactEmitter.on('statusUpdate', handleStatusUpdate);

    return () => {
      codeArtifactEmitter.off('contentUpdate', handleContentUpdate);
      codeArtifactEmitter.off('statusUpdate', handleStatusUpdate);
    };
  }, [
    artifactId,
    currentTab,
    currentType,
    node?.id,
    updateNodeMetadata,
    node.data?.metadata,
    content,
    canvasReadOnly,
    status,
    syncNodeWithServer,
  ]);

  // Update node data when tab changes - use callback to prevent re-creation
  const handleTabChange = useCallback(
    (tab: 'code' | 'preview') => {
      setCurrentTab(tab);

      // Update the node metadata to persist tab change
      if (node?.id) {
        // First update local node metadata
        updateNodeMetadata(node.id, {
          ...node.data?.metadata,
          activeTab: tab,
        });

        // Then sync with server to ensure it persists across page refreshes
        if (!canvasReadOnly && artifactId) {
          const currentContent = content || prevContentRef.current;
          const currentNodeType = node.data?.metadata?.type || currentType;

          // Use the syncNodeWithServer function to ensure changes persist
          syncNodeWithServer(
            artifactId,
            currentContent,
            currentNodeType as CodeArtifactType,
            canvasReadOnly,
          );
        }
      }
    },
    [
      node?.id,
      updateNodeMetadata,
      node.data?.metadata,
      canvasReadOnly,
      artifactId,
      content,
      currentType,
      syncNodeWithServer,
    ],
  );

  // Also ensure type changes are synchronized with the server
  const handleTypeChange = useCallback(
    async (newType: CodeArtifactType) => {
      try {
        // Update local state first
        setCurrentType(newType);

        // Update node metadata to persist the type change
        if (node?.id) {
          updateNodeMetadata(node.id, {
            ...node.data?.metadata,
            type: newType,
          });
        }

        // Save the type change to the server if we're not in readonly mode
        if (!canvasReadOnly && status !== 'generating' && artifactId) {
          // Always include the current content to prevent it from being cleared
          const currentContent = content || prevContentRef.current;

          // Sync the changes with the server
          syncNodeWithServer(artifactId, currentContent, newType, canvasReadOnly);
        }
      } catch (error) {
        console.error('Failed to update code artifact type:', error);
      }
    },
    [
      artifactId,
      canvasReadOnly,
      status,
      content,
      node?.id,
      updateNodeMetadata,
      node.data?.metadata,
      syncNodeWithServer,
    ],
  );

  const handleRequestFix = useCallback(
    (errorMessage: string) => {
      console.error('Code artifact error:', errorMessage);

      // Emit event to exit fullscreen mode before proceeding
      if (node?.id) {
        fullscreenEmitter.emit('exitFullscreenForFix', { nodeId: node.id });
      }

      // Define a proper code fix skill similar to editDoc
      const codeFixSkill: Skill = {
        name: 'codeArtifacts',
        icon: {
          type: 'emoji',
          value: '🔧',
        },
        description: t('codeArtifact.fix.title'),
        configSchema: {
          items: [],
        },
      };

      // Get the current model
      const { selectedModel } = useChatStore.getState();

      // Create a skill node with the code artifact as context and error message in the query
      addNode(
        {
          type: 'skill',
          data: {
            title: t('codeArtifact.fix.title'),
            entityId: genSkillID(),
            metadata: {
              contextItems: [
                {
                  type: 'codeArtifact',
                  title: node?.data?.contentPreview
                    ? `${node.data.title} - ${node.data.contentPreview?.slice(0, 10)}`
                    : (node.data?.title ?? ''),
                  entityId: node.data?.entityId ?? '',
                  metadata: node.data?.metadata,
                },
              ] as IContextItem[],
              query: t('codeArtifact.fix.query', {
                errorMessage,
              }),
              selectedSkill: codeFixSkill,
              modelInfo: selectedModel,
              tplConfig: {
                codeErrorConfig: {
                  value: {
                    errorMessage,
                    language: node.data?.metadata?.language || 'typescript',
                    codeEntityId: node.data?.entityId || '',
                  },
                  configScope: 'runtime' as unknown as ConfigScope,
                  displayValue: t('codeArtifact.fix.errorConfig'),
                  label: t('codeArtifact.fix.errorConfig'),
                },
              },
            },
          },
        },
        // Connect the skill node to the code artifact node
        [{ type: 'codeArtifact', entityId }],
        false,
        true,
      );
    },
    [node, addNode, t, entityId],
  );

  const handleClose = useCallback(() => {
    setIsShowingCodeViewer(false);
  }, []);

  // Use debounced callback for updating remote artifact with cleanup
  const updateRemoteArtifact = useDebouncedCallback(async (newCode: string) => {
    if (!artifactId) return;

    try {
      await getClient().updateCodeArtifact({
        body: {
          artifactId,
          content: newCode,
        },
      });
    } catch (error) {
      console.error('Failed to update code artifact:', error);
    }
  }, 500);

  // Handle code changes with improved performance - always accept user edits
  const handleCodeChange = useCallback(
    (newCode: string) => {
      // Always update state for user edits
      setContent(newCode);
      prevContentRef.current = newCode;

      if (status !== 'generating' && !canvasReadOnly) {
        updateRemoteArtifact(newCode);
      }
    },
    [status, canvasReadOnly, updateRemoteArtifact],
  );

  // Create memoized CodeViewer props to prevent unnecessary re-renders
  const codeViewerProps = useMemo(
    () => ({
      code: content,
      language,
      title: node.data?.title || t('codeArtifact.defaultTitle', 'Code Artifact'),
      entityId,
      isGenerating: status === 'generating',
      activeTab: currentTab,
      onTabChange: handleTabChange,
      onTypeChange: handleTypeChange,
      onClose: handleClose,
      onRequestFix: handleRequestFix,
      onChange: handleCodeChange,
      canvasReadOnly,
      type: currentType as CodeArtifactType,
    }),
    [
      content,
      language,
      node.data?.title,
      t,
      entityId,
      status,
      currentTab,
      handleTabChange,
      handleTypeChange,
      handleClose,
      handleRequestFix,
      handleCodeChange,
      canvasReadOnly,
      currentType,
    ],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      updateRemoteArtifact.cancel();
    };
  }, [updateRemoteArtifact]);

  if (!artifactId) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded p-3">
        <span className="text-gray-500">
          {t('codeArtifact.noSelection', 'No code artifact selected')}
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full grow items-center justify-center">
        <div className="text-gray-500">{t('codeArtifact.shareLoading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded px-4">
      <CodeViewerLayout isShowing={isShowingCodeViewer}>
        {isShowingCodeViewer && <CodeViewer {...codeViewerProps} />}
      </CodeViewerLayout>
    </div>
  );
};

export const CodeArtifactNodePreview = memo(
  CodeArtifactNodePreviewComponent,
  (prevProps, nextProps) =>
    prevProps.artifactId === nextProps.artifactId &&
    prevProps.node?.data?.metadata?.status === nextProps.node?.data?.metadata?.status &&
    prevProps.node?.data?.metadata?.language === nextProps.node?.data?.metadata?.language &&
    prevProps.node?.data?.metadata?.activeTab === nextProps.node?.data?.metadata?.activeTab &&
    prevProps.node?.data?.metadata?.type === nextProps.node?.data?.metadata?.type,
);
