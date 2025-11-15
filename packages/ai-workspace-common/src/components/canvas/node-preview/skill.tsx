import { useState, useCallback, useEffect, memo, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { ModelInfo } from '@refly/openapi-schema';
import { CanvasNode, CanvasNodeData, SkillNodeMeta } from '@refly/canvas-common';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useChatStoreShallow } from '@refly/stores';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { IContextItem } from '@refly/common-types';
import { useContextPanelStore } from '@refly/stores';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { genActionResultID } from '@refly/utils/id';
import { convertContextItemsToNodeFilters } from '@refly/canvas-common';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useReactFlow } from '@xyflow/react';
import { GenericToolset } from '@refly/openapi-schema';

interface SkillNodePreviewProps {
  node: CanvasNode<SkillNodeMeta>;
}

export const SkillNodePreview = memo(({ node }: SkillNodePreviewProps) => {
  const chatInputRef = useRef<HTMLDivElement>(null);
  const { deleteElements } = useReactFlow();

  const { entityId, metadata = {} } = node?.data ?? {};
  const {
    query,
    modelInfo,
    contextItems = [],
    selectedToolsets: metadataSelectedToolsets = [],
  } = metadata;

  const [localQuery, setLocalQuery] = useState(query);
  const [selectedToolsets, setLocalSelectedToolsets] =
    useState<GenericToolset[]>(metadataSelectedToolsets);

  // Update local state when query changes from external sources
  useEffect(() => {
    if (query !== localQuery) {
      setLocalQuery(query);
    }
  }, [query]);

  // Update local state when selectedToolsets changes from external sources
  useEffect(() => {
    if (metadataSelectedToolsets !== selectedToolsets) {
      setLocalSelectedToolsets(metadataSelectedToolsets);
    }
  }, [metadataSelectedToolsets, selectedToolsets]);

  const { skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
    setSkillSelectedModel: state.setSkillSelectedModel,
  }));

  const { invokeAction, abortAction } = useInvokeAction({ source: 'skill-node-preview' });
  const { canvasId, readonly } = useCanvasContext();
  const { handleUploadImage } = useUploadImage();
  const { addNode } = useAddNode();
  const setNodeDataByEntity = useSetNodeDataByEntity();

  const updateNodeData = useDebouncedCallback((data: Partial<CanvasNodeData<SkillNodeMeta>>) => {
    if (node?.id) {
      setNodeDataByEntity({ entityId, type: 'skill' }, data);
    }
  }, 50);

  const setQuery = useCallback(
    (query: string) => {
      setLocalQuery(query);
      updateNodeData({ title: query, metadata: { query } });
    },
    [entityId, updateNodeData],
  );

  const setModelInfo = useCallback(
    (modelInfo: ModelInfo | null) => {
      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { modelInfo } });
      setSkillSelectedModel(modelInfo);
    },
    [entityId, setNodeDataByEntity, setSkillSelectedModel],
  );

  const setContextItems = useCallback(
    (items: IContextItem[]) => {
      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { contextItems: items } });
    },
    [entityId, setNodeDataByEntity],
  );

  useEffect(() => {
    if (skillSelectedModel && !modelInfo) {
      setModelInfo(skillSelectedModel);
    }
  }, [skillSelectedModel, modelInfo, setModelInfo]);

  const handleSendMessage = useCallback(() => {
    if (!node) return;

    const data = node?.data as CanvasNodeData<SkillNodeMeta>;
    const { query = '', contextItems = [], runtimeConfig = {} } = data?.metadata ?? {};
    const { runtimeConfig: contextRuntimeConfig = {} } = useContextPanelStore.getState();

    deleteElements({ nodes: [node] });

    setTimeout(() => {
      const resultId = genActionResultID();
      invokeAction(
        {
          resultId,
          ...data?.metadata,
          runtimeConfig: {
            ...contextRuntimeConfig,
            ...runtimeConfig,
          },
        },
        {
          entityId: canvasId,
          entityType: 'canvas',
        },
      );
      addNode(
        {
          type: 'skillResponse',
          data: {
            title: query,
            entityId: resultId,
            metadata: {
              status: 'executing',
              contextItems,
              selectedToolsets,
            },
          },
          position: node.position,
        },
        convertContextItemsToNodeFilters(contextItems),
      );
    });
  }, [node, deleteElements, invokeAction, canvasId, addNode, selectedToolsets]);

  const handleImageUpload = async (file: File) => {
    const resource = await handleUploadImage(file, canvasId);
    if (resource) {
      const newContextItems = [
        ...(contextItems ?? []),
        {
          type: 'resource',
          entityId: resource.resourceId,
          title: resource.title,
          metadata: {
            resourceType: resource.resourceType,
            resourceMeta: resource.data,
            storageKey: resource.storageKey,
            rawFileKey: resource.rawFileKey,
            downloadURL: resource.downloadURL,
          },
        },
      ];
      setContextItems(newContextItems as IContextItem[]);
    }
  };

  const setSelectedToolsets = useCallback(
    (toolsets: GenericToolset[]) => {
      setLocalSelectedToolsets(toolsets);
      updateNodeData({ metadata: { selectedToolsets: toolsets } });
    },
    [updateNodeData],
  );

  if (!node) return null;

  return (
    <div className="flex flex-col gap-3 h-full p-3 box-border">
      <ContextManager
        className="px-0.5"
        contextItems={contextItems}
        setContextItems={setContextItems}
      />
      <ChatInput
        readonly={readonly}
        ref={chatInputRef}
        query={localQuery ?? ''}
        setQuery={setQuery}
        inputClassName="px-1 py-0"
        maxRows={100}
        handleSendMessage={handleSendMessage}
        onUploadImage={handleImageUpload}
      />

      <ChatActions
        query={localQuery ?? ''}
        model={modelInfo ?? null}
        setModel={setModelInfo}
        handleSendMessage={handleSendMessage}
        handleAbort={abortAction}
        onUploadImage={handleImageUpload}
        contextItems={contextItems}
        selectedToolsets={selectedToolsets}
        setSelectedToolsets={setSelectedToolsets}
      />
    </div>
  );
});

SkillNodePreview.displayName = 'SkillNodePreview';
