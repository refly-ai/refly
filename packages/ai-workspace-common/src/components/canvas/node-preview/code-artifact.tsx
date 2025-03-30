import { useState, memo, useCallback, useEffect, useMemo } from 'react';
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

  // Use activeTab from node metadata with fallback to 'code'
  const { activeTab = 'code', type = 'text/html', language = 'html' } = node.data?.metadata || {};
  const [currentTab, setCurrentTab] = useState<'code' | 'preview'>(activeTab as 'code' | 'preview');
  const [currentType, setCurrentType] = useState<CodeArtifactType>(type as CodeArtifactType);

  const status = node?.data?.metadata?.status;
  const entityId = node?.data?.entityId ?? '';
  const shareId = node?.data?.metadata?.shareId ?? '';

  // Effect to update local state when node.data.metadata changes
  useEffect(() => {
    const metadata = node.data?.metadata;
    if (metadata) {
      // Only update if different from current state to prevent unnecessary renders
      if (metadata.activeTab && metadata.activeTab !== currentTab) {
        setCurrentTab(metadata.activeTab as 'code' | 'preview');
      }
      if (metadata.type && metadata.type !== currentType) {
        const detectedType = detectTypeFromContent(metadata.type);
        setCurrentType(detectedType as CodeArtifactType);
      }
    }
  }, [node.data?.metadata, currentTab, currentType]);

  const { data: remoteData, isLoading: isRemoteLoading } = useGetCodeArtifactDetail(
    {
      query: {
        artifactId,
      },
    },
    null,
    { enabled: isLogin && !shareId && artifactId && status?.startsWith('finish') },
  );
  const { data: shareData, loading: isShareLoading } = useFetchShareData<CodeArtifact>(shareId);

  const isLoading = isRemoteLoading || isShareLoading;

  const artifactData = useMemo(
    () => shareData || remoteData?.data || null,
    [shareData, remoteData],
  );
  const [content, setContent] = useState(artifactData?.content ?? '');

  useEffect(() => {
    const handleContentUpdate = (data: { artifactId: string; content: string }) => {
      if (data.artifactId === artifactId && status === 'generating') {
        setContent(data.content);
      }
    };

    const handleStatusUpdate = (data: { artifactId: string; status: 'finish' | 'generating' }) => {
      if (data.artifactId === artifactId) {
        // Only update currentTab if status has changed to prevent unnecessary re-renders
        if (data.status === 'finish' && currentTab !== 'preview') {
          setCurrentTab('preview');
        } else if (data.status === 'generating' && currentTab !== 'code') {
          setCurrentTab('code');
        }
      }
    };

    codeArtifactEmitter.on('contentUpdate', handleContentUpdate);
    codeArtifactEmitter.on('statusUpdate', handleStatusUpdate);

    return () => {
      codeArtifactEmitter.off('contentUpdate', handleContentUpdate);
      codeArtifactEmitter.off('statusUpdate', handleStatusUpdate);
    };
  }, [status, artifactId, currentTab]);

  useEffect(() => {
    if (artifactData) {
      setContent(artifactData.content);
    }
  }, [artifactData]);

  // Update node data when tab changes - use callback to prevent re-creation
  const handleTabChange = useCallback((tab: 'code' | 'preview') => {
    setCurrentTab(tab);
  }, []);

  const handleTypeChange = useCallback((newType: CodeArtifactType) => {
    // Update local state first
    setCurrentType(newType);
  }, []);

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

  // Use debounced callback for updating remote artifact
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

  // Handle code changes with improved performance
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setContent(newCode);

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
