import { useState, memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CanvasNode,
  CodeArtifactNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import CodeViewerLayout from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer-layout';
import CodeViewer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/code-viewer';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly-packages/utils/id';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useChatStore } from '@refly-packages/ai-workspace-common/stores/chat';
import { ConfigScope, Skill } from '@refly/openapi-schema';
import { CodeArtifactType } from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/types';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { fullscreenEmitter } from '@refly-packages/ai-workspace-common/events/fullscreen';

interface CodeArtifactNodePreviewProps {
  node: CanvasNode<CodeArtifactNodeMeta>;
  artifactId: string;
}

const CodeArtifactNodePreviewComponent = ({ node, artifactId }: CodeArtifactNodePreviewProps) => {
  const { t } = useTranslation();
  const [isShowingCodeViewer, setIsShowingCodeViewer] = useState(true);
  const setNodeDataByEntity = useSetNodeDataByEntity();
  const { addNode } = useAddNode();
  const { readonly: canvasReadOnly } = useCanvasContext();
  // Use activeTab from node metadata with fallback to 'code'
  const { activeTab = 'code', type = 'text/html', language = 'html' } = node.data?.metadata || {};
  const [currentTab, setCurrentTab] = useState<'code' | 'preview'>(activeTab as 'code' | 'preview');
  const [currentType, setCurrentType] = useState<CodeArtifactType>(type as CodeArtifactType);
  const data = node?.data;

  // Sync local state with node metadata changes
  useEffect(() => {
    // Only update if activeTab changes and is different from current state
    const metadataActiveTab = node.data?.metadata?.activeTab as 'code' | 'preview';
    if (metadataActiveTab && metadataActiveTab !== currentTab) {
      setCurrentTab(metadataActiveTab);
    }

    // Update type if it changes in metadata
    const metadataType = node.data?.metadata?.type as CodeArtifactType;
    if (metadataType && metadataType !== currentType) {
      setCurrentType(metadataType);
    }
  }, [node.data?.metadata?.activeTab, node.data?.metadata?.type]);

  // Update node data when tab changes
  const handleTabChange = useCallback(
    (tab: 'code' | 'preview') => {
      setCurrentTab(tab);

      // if (node.data?.entityId) {
      //   setNodeDataByEntity(
      //     {
      //       type: 'codeArtifact',
      //       entityId: node.data.entityId,
      //     },
      //     {
      //       metadata: {
      //         ...node.data?.metadata,
      //         activeTab: tab,
      //       },
      //     },
      //   );
      // }
    },
    [node.data?.entityId, node.data?.metadata, setNodeDataByEntity],
  );

  const handleTypeChange = useCallback(
    (newType: CodeArtifactType) => {
      // Update local state first
      setCurrentType(newType);

      // Ensure newType is a valid CodeArtifactType
      // if (data?.entityId && newType) {
      //   setNodeDataByEntity(
      //     {
      //       type: 'codeArtifact',
      //       entityId: data.entityId,
      //     },
      //     {
      //       metadata: {
      //         ...data?.metadata,
      //         type: newType,
      //       },
      //     },
      //   );
      // }
    },
    [data?.entityId, data?.metadata, setNodeDataByEntity, setCurrentType],
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
        [{ type: 'codeArtifact', entityId: node.data?.entityId ?? '' }],
        false,
        true,
      );
    },
    [node, addNode, t],
  );

  const handleClose = useCallback(() => {
    setIsShowingCodeViewer(false);
  }, []);

  // Handle code changes
  const handleCodeChange = useCallback(
    (newCode: string) => {
      if (data?.entityId) {
        setNodeDataByEntity(
          {
            type: 'codeArtifact',
            entityId: data.entityId,
          },
          {
            contentPreview: newCode,
          },
        );
      }
    },
    [data?.entityId, setNodeDataByEntity],
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

  // Determine which content to show - prefer action result store content, fallback to document content
  const content = node?.data?.contentPreview || '';
  const isGenerating = node.data?.metadata?.status === 'generating';

  return (
    <div className="h-full bg-white rounded px-4">
      <CodeViewerLayout isShowing={isShowingCodeViewer}>
        {isShowingCodeViewer && (
          <CodeViewer
            code={content}
            language={language}
            title={node.data?.title || t('codeArtifact.defaultTitle', 'Code Artifact')}
            entityId={node.data?.entityId ?? ''}
            isGenerating={isGenerating}
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
  (prevProps, nextProps) =>
    prevProps.artifactId === nextProps.artifactId &&
    prevProps.node?.data?.contentPreview === nextProps.node?.data?.contentPreview &&
    prevProps.node?.data?.metadata?.status === nextProps.node?.data?.metadata?.status &&
    prevProps.node?.data?.metadata?.language === nextProps.node?.data?.metadata?.language &&
    prevProps.node?.data?.metadata?.activeTab === nextProps.node?.data?.metadata?.activeTab &&
    prevProps.node?.data?.metadata?.type === nextProps.node?.data?.metadata?.type,
);
