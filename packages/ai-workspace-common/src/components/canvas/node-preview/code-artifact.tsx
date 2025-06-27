import { useState, memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode, CodeArtifactNodeMeta } from '@refly/canvas-common';
import CodeViewerLayout from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer-layout';
import CodeViewer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';
import { IContextItem } from '@refly/common-types';
import { detectActualTypeFromType } from '@refly/utils';
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
import { useNodesData } from '@xyflow/react';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';

interface CodeArtifactNodePreviewProps {
  nodeId: string;
}

const CodeArtifactNodePreviewComponent = ({ nodeId }: CodeArtifactNodePreviewProps) => {
  const { t } = useTranslation();
  const [isShowingCodeViewer, setIsShowingCodeViewer] = useState(true);
  const { addNode } = useAddNode();
  const { readonly: canvasReadOnly } = useCanvasContext();
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const setNodeDataByEntity = useSetNodeDataByEntity();

  const { data } = useNodesData<CanvasNode<CodeArtifactNodeMeta>>(nodeId) ?? {};

  const artifactId = data?.entityId ?? '';
  const {
    title,
    status,
    shareId,
    activeTab = 'code',
    type = 'text/html',
    language = 'html',
  } = data?.metadata || {};

  const [currentTab, setCurrentTab] = useState<'code' | 'preview'>(activeTab as 'code' | 'preview');
  const [currentType, setCurrentType] = useState<CodeArtifactType>(type as CodeArtifactType);

  const { data: remoteData, isLoading: isRemoteLoading } = useGetCodeArtifactDetail(
    {
      query: {
        artifactId,
      },
    },
    null,
    { enabled: Boolean(isLogin && !shareId && artifactId && status?.startsWith('finish')) },
  );
  const { data: shareData, loading: isShareLoading } = useFetchShareData<CodeArtifact>(shareId);

  const isLoading = isRemoteLoading || isShareLoading;

  const artifactData = useMemo(
    () => shareData || remoteData?.data || null,
    [shareData, remoteData],
  );
  const [content, setContent] = useState(artifactData?.content ?? '');

  useEffect(() => {
    if (type !== currentType) {
      setCurrentType(detectActualTypeFromType(type));
    }
  }, [type]);

  useEffect(() => {
    if (activeTab !== currentTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleContentUpdate = (data: { artifactId: string; content: string }) => {
      if (data.artifactId === artifactId) {
        setContent(data.content);
      }
    };

    const handleStatusUpdate = (data: {
      artifactId: string;
      status: 'finish' | 'generating';
      type: CodeArtifactType;
    }) => {
      if (data.artifactId === artifactId) {
        setCurrentTab(data?.status === 'finish' ? 'preview' : 'code');

        if (data?.type !== currentType) {
          setCurrentType(detectActualTypeFromType(data?.type));
        }

        // Save to node metadata when status updates
        if (artifactId) {
          setNodeDataByEntity(
            { type: 'codeArtifact', entityId: artifactId },
            {
              metadata: {
                activeTab: data?.status === 'finish' ? 'preview' : 'code',
                type: detectActualTypeFromType(data?.type),
              },
            },
          );
        }
      }
    };

    codeArtifactEmitter.on('contentUpdate', handleContentUpdate);
    codeArtifactEmitter.on('statusUpdate', handleStatusUpdate);

    return () => {
      codeArtifactEmitter.off('contentUpdate', handleContentUpdate);
      codeArtifactEmitter.off('statusUpdate', handleStatusUpdate);
    };
  }, [status, artifactId, currentType, setNodeDataByEntity]);

  useEffect(() => {
    if (artifactData) {
      setContent(artifactData.content);
    }
  }, [artifactData]);

  // Update node data when tab changes
  const handleTabChange = useCallback(
    (tab: 'code' | 'preview') => {
      setCurrentTab(tab);

      // Save tab change to node metadata
      if (artifactId) {
        setNodeDataByEntity(
          { type: 'codeArtifact', entityId: artifactId },
          { metadata: { activeTab: tab } },
        );
      }
    },
    [artifactId, setNodeDataByEntity],
  );

  const handleTypeChange = useCallback(
    (newType: CodeArtifactType) => {
      // Update local state first
      setCurrentType(newType);

      // Save type change to node metadata
      if (artifactId) {
        setNodeDataByEntity(
          { type: 'codeArtifact', entityId: artifactId },
          { metadata: { type: newType } },
        );
      }
    },
    [artifactId, setNodeDataByEntity],
  );

  const handleRequestFix = useCallback(
    (errorMessage: string) => {
      if (!data?.entityId) {
        return;
      }

      // Emit event to exit fullscreen mode before proceeding
      if (nodeId) {
        fullscreenEmitter.emit('exitFullscreenForFix', { nodeId });
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
                  title: data?.title,
                  entityId: data?.entityId ?? '',
                  metadata: data?.metadata,
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
                    language: data?.metadata?.language || 'typescript',
                    codeEntityId: data?.entityId || '',
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
        [{ type: 'codeArtifact', entityId: data?.entityId }],
        false,
        true,
      );
    },
    [data, addNode, t],
  );

  const handleClose = useCallback(() => {
    setIsShowingCodeViewer(false);
  }, []);

  const updateRemoteArtifact = useDebouncedCallback(async (newCode: string) => {
    await getClient().updateCodeArtifact({
      body: {
        artifactId,
        content: newCode,
      },
    });
  }, 500);

  // Handle code changes
  const handleCodeChange = useCallback(
    async (newCode: string) => {
      setContent(newCode);

      if (status !== 'generating' && !canvasReadOnly) {
        updateRemoteArtifact(newCode);
      }
    },
    [status, canvasReadOnly, artifactId, updateRemoteArtifact, setNodeDataByEntity],
  );

  if (!artifactId) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded p-3">
        <span className="text-gray-500">{t('codeArtifact.noSelection')}</span>
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
    <div className="h-full bg-white rounded px-4 dark:bg-gray-900">
      <CodeViewerLayout isShowing={isShowingCodeViewer}>
        {isShowingCodeViewer && (
          <CodeViewer
            code={content}
            language={language}
            title={title || t('codeArtifact.defaultTitle', 'Code Artifact')}
            entityId={artifactId}
            isGenerating={status === 'generating' || status === 'executing'}
            activeTab={currentTab}
            onTabChange={handleTabChange}
            onTypeChange={handleTypeChange}
            onClose={handleClose}
            onRequestFix={handleRequestFix}
            onChange={handleCodeChange}
            canvasReadOnly={canvasReadOnly}
            type={currentType as CodeArtifactType}
          />
        )}
      </CodeViewerLayout>
    </div>
  );
};

export const CodeArtifactNodePreview = memo(
  CodeArtifactNodePreviewComponent,
  (prevProps, nextProps) => prevProps.nodeId === nextProps.nodeId,
);
