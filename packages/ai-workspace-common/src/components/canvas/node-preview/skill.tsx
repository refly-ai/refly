import { useState, useCallback, useEffect, memo, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useTranslation } from 'react-i18next';
import { IconClose } from '@arco-design/web-react/icon';
import { Button, Form } from 'antd';
import { ModelInfo, Skill, SkillRuntimeConfig, SkillTemplateConfig } from '@refly/openapi-schema';
import { CanvasNode, CanvasNodeData, SkillNodeMeta } from '../nodes/shared/types';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import {
  IContextItem,
  useContextPanelStore,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { genActionResultID } from '@refly/utils/id';
import { convertContextItemsToNodeFilters } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useReactFlow } from '@xyflow/react';

// Memoized Header Component
const NodeHeader = memo(
  ({
    selectedSkillName,
    setSelectedSkill,
    readonly,
  }: {
    selectedSkillName?: string;
    setSelectedSkill: (skill: Skill | null) => void;
    readonly: boolean;
  }) => {
    const { t } = useTranslation();
    return (
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#6172F3] shadow-lg flex items-center justify-center flex-shrink-0">
            {getSkillIcon(selectedSkillName, 'w-4 h-4 text-white')}
          </div>
          <span className="text-sm font-medium leading-normal text-[rgba(0,0,0,0.8)] truncate dark:text-[rgba(225,225,225,0.8)]">
            {selectedSkillName
              ? t(`${selectedSkillName}.name`, { ns: 'skill' })
              : t('canvas.skill.askAI')}
          </span>
        </div>
        {selectedSkillName && !readonly && (
          <Button
            type="text"
            size="small"
            className="p-0"
            icon={<IconClose />}
            onClick={() => {
              setSelectedSkill?.(null);
            }}
          />
        )}
      </div>
    );
  },
);

NodeHeader.displayName = 'NodeHeader';

interface SkillNodePreviewProps {
  node: CanvasNode<SkillNodeMeta>;
}

export const SkillNodePreview = memo(({ node }: SkillNodePreviewProps) => {
  const [form] = Form.useForm();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const chatInputRef = useRef<HTMLDivElement>(null);
  const { deleteElements } = useReactFlow();

  const { entityId, metadata = {} } = node?.data ?? {};
  const { query, selectedSkill, modelInfo, contextItems = [], tplConfig, runtimeConfig } = metadata;
  const skill = useFindSkill(selectedSkill?.name);

  const [localQuery, setLocalQuery] = useState(query);

  // Update local state when query changes from external sources
  useEffect(() => {
    if (query !== localQuery) {
      setLocalQuery(query);
    }
  }, [query]);

  const { skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
    setSkillSelectedModel: state.setSkillSelectedModel,
  }));

  const { invokeAction, abortAction } = useInvokeAction();
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

  const setRuntimeConfig = useCallback(
    (runtimeConfig: SkillRuntimeConfig) => {
      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { runtimeConfig } });
    },
    [entityId, setNodeDataByEntity],
  );

  useEffect(() => {
    if (skillSelectedModel && !modelInfo) {
      setModelInfo(skillSelectedModel);
    }
  }, [skillSelectedModel, modelInfo, setModelInfo]);

  const setSelectedSkill = useCallback(
    (newSelectedSkill: Skill | null) => {
      const selectedSkill = newSelectedSkill;

      // Reset form when skill changes
      if (selectedSkill?.configSchema?.items?.length) {
        const defaultConfig = {};
        for (const item of selectedSkill.configSchema.items) {
          if (item.defaultValue !== undefined) {
            defaultConfig[item.key] = {
              value: item.defaultValue,
              label: item.labelDict?.en ?? item.key,
              displayValue: String(item.defaultValue),
            };
          }
        }
        form.setFieldValue('tplConfig', defaultConfig);
      } else {
        form.setFieldValue('tplConfig', undefined);
      }

      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { selectedSkill } });
    },
    [entityId, form, setNodeDataByEntity],
  );

  const handleSelectSkill = useCallback(
    (skillToSelect: Skill | null) => {
      // Ensure we don't trigger updates if skill is the same
      if (skillToSelect?.name === selectedSkill?.name) return;

      setQuery(localQuery?.slice(0, -1) ?? '');
      setSelectedSkill(skillToSelect);
    },
    [localQuery, selectedSkill?.name, setQuery, setSelectedSkill],
  );

  const handleSendMessage = useCallback(() => {
    if (!node) return;

    const data = node?.data as CanvasNodeData<SkillNodeMeta>;
    const { query = '', contextItems = [], runtimeConfig = {} } = data?.metadata ?? {};
    const { runtimeConfig: contextRuntimeConfig = {} } = useContextPanelStore.getState();

    const tplConfig = form.getFieldValue('tplConfig');

    deleteElements({ nodes: [node] });

    setTimeout(() => {
      const resultId = genActionResultID();
      invokeAction(
        {
          resultId,
          ...data?.metadata,
          tplConfig,
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
              tplConfig,
            },
          },
          position: node.position,
        },
        convertContextItemsToNodeFilters(contextItems),
      );
    });
  }, [node, deleteElements, invokeAction, canvasId, addNode, form]);

  const handleImageUpload = async (file: File) => {
    const nodeData = await handleUploadImage(file, canvasId);
    if (nodeData) {
      const newContextItems = [
        ...(contextItems ?? []),
        {
          type: 'image' as const,
          ...nodeData,
        },
      ];
      setContextItems(newContextItems as IContextItem[]);
    }
  };

  const handleTplConfigChange = useCallback(
    (config: SkillTemplateConfig) => {
      setNodeDataByEntity({ entityId, type: 'skill' }, { metadata: { tplConfig: config } });
    },
    [entityId, setNodeDataByEntity],
  );

  if (!node) return null;

  return (
    <div className="flex flex-col gap-3 h-full p-3 box-border">
      <NodeHeader
        readonly={readonly}
        selectedSkillName={skill?.name}
        setSelectedSkill={setSelectedSkill}
      />

      <ContextManager
        className="px-0.5"
        contextItems={contextItems}
        setContextItems={setContextItems}
      />

      <ChatInput
        readonly={readonly}
        ref={chatInputRef}
        query={localQuery}
        setQuery={setQuery}
        selectedSkillName={skill?.name}
        inputClassName="px-1 py-0"
        maxRows={100}
        handleSendMessage={handleSendMessage}
        handleSelectSkill={handleSelectSkill}
        onUploadImage={handleImageUpload}
      />

      {skill?.configSchema?.items?.length > 0 && (
        <ConfigManager
          readonly={readonly}
          key={skill?.name}
          form={form}
          formErrors={formErrors}
          setFormErrors={setFormErrors}
          schema={skill?.configSchema}
          tplConfig={tplConfig}
          fieldPrefix="tplConfig"
          configScope="runtime"
          resetConfig={() => {
            const defaultConfig = skill?.tplConfig ?? {};
            form.setFieldValue('tplConfig', defaultConfig);
          }}
          onFormValuesChange={(_changedValues, allValues) => {
            handleTplConfigChange(allValues.tplConfig);
          }}
        />
      )}

      <ChatActions
        query={localQuery}
        model={modelInfo}
        setModel={setModelInfo}
        handleSendMessage={handleSendMessage}
        handleAbort={abortAction}
        onUploadImage={handleImageUpload}
        contextItems={contextItems}
        runtimeConfig={runtimeConfig}
        setRuntimeConfig={setRuntimeConfig}
      />
    </div>
  );
});

SkillNodePreview.displayName = 'SkillNodePreview';
