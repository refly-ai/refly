import { useTranslation } from 'react-i18next';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useMemo, memo, useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import {
  ChatActions,
  CustomAction,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import {
  ModelInfo,
  Skill,
  SkillRuntimeConfig,
  SkillTemplateConfig,
} from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { convertContextItemsToEdges } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useReactFlow } from '@xyflow/react';
import { GrRevert } from 'react-icons/gr';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { notification, Form, Badge } from 'antd';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { McpSelectorPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';
import { ToolOutlined } from '@ant-design/icons';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';

interface EditChatInputProps {
  enabled: boolean;
  resultId: string;
  version?: number;
  contextItems: IContextItem[];
  query: string;
  modelInfo: ModelInfo;
  actionMeta?: {
    icon?: any;
    name?: string;
  };
  setEditMode: (mode: boolean) => void;
  readonly?: boolean;
  tplConfig?: SkillTemplateConfig;
  runtimeConfig?: SkillRuntimeConfig;
}

const EditChatInputComponent = (props: EditChatInputProps) => {
  const {
    enabled,
    resultId,
    version,
    contextItems,
    query,
    modelInfo,
    actionMeta,
    setEditMode,
    readonly,
    tplConfig: initialTplConfig,
    runtimeConfig,
  } = props;

  const { getEdges, getNodes, deleteElements, addEdges } = useReactFlow();
  const [editQuery, setEditQuery] = useState<string>(query);
  const [editContextItems, setEditContextItems] = useState<IContextItem[]>(contextItems);
  const [editModelInfo, setEditModelInfo] = useState<ModelInfo>(modelInfo);
  const [editRuntimeConfig, setEditRuntimeConfig] = useState<SkillRuntimeConfig>(runtimeConfig);
  const contextItemsRef = useRef(editContextItems);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { t } = useTranslation();
  const [localActionMeta, setLocalActionMeta] = useState<{
    name?: string;
    icon?: any;
  } | null>(actionMeta);

  const [form] = Form.useForm();
  const { getFinalProjectId } = useAskProject();

  const hideSelectedSkillHeader = useMemo(
    () => !localActionMeta || localActionMeta?.name === 'commonQnA' || !localActionMeta?.name,
    [localActionMeta],
  );

  const { canvasId, readonly: canvasReadonly } = useCanvasContext();
  const { invokeAction } = useInvokeAction();
  const skill = useFindSkill(localActionMeta?.name);
  const {
    handleUploadImage: uploadImageHook,
    handleUploadMultipleImages: uploadMultipleImagesHook,
  } = useUploadImage();

  const textareaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (enabled && textareaRef.current) {
      const textarea = textareaRef.current.querySelector('textarea');
      if (textarea) {
        const length = textarea.value.length;
        textarea.focus();
        textarea.setSelectionRange(length, length);
      }
    }
  }, [enabled]);

  // Initialize form with tplConfig when skill changes
  useEffect(() => {
    if (!skill?.configSchema?.items?.length) {
      form.setFieldValue('tplConfig', undefined);
    } else {
      // Create a new config object
      const newConfig = {};

      // Process each item in the schema
      for (const item of skill?.configSchema?.items || []) {
        const key = item.key;

        // Priority 1: Check if the key exists in initialTplConfig
        if (initialTplConfig && initialTplConfig[key] !== undefined) {
          newConfig[key] = initialTplConfig[key];
        }
        // Priority 2: Fall back to schema default value
        else if (item.defaultValue !== undefined) {
          newConfig[key] = {
            value: item.defaultValue,
            label: item.labelDict?.en ?? item.key,
            displayValue: String(item.defaultValue),
          };
        }
      }

      // Set the form value with the properly prioritized config
      form.setFieldValue('tplConfig', newConfig);
    }
  }, [skill, form, initialTplConfig]);

  useEffect(() => {
    contextItemsRef.current = editContextItems;
  }, [editContextItems]);

  const handleSendMessage = useCallback(() => {
    // Check for form errors
    if (formErrors && Object.keys(formErrors).length > 0) {
      notification.error({
        message: t('copilot.configManager.errorTipTitle'),
        description: t('copilot.configManager.errorTip'),
      });
      return;
    }

    // Get tplConfig from form
    const tplConfig = form?.getFieldValue('tplConfig');
    const finalProjectId = getFinalProjectId();

    // Synchronize edges with latest context items
    const nodes = getNodes();
    const currentNode = nodes.find((node) => node.data?.entityId === resultId);
    if (!currentNode) {
      return;
    }

    const edges = getEdges();
    const { edgesToAdd, edgesToDelete } = convertContextItemsToEdges(
      resultId,
      editContextItems,
      nodes,
      edges,
    );
    addEdges(edgesToAdd);
    deleteElements({ edges: edgesToDelete });

    invokeAction(
      {
        resultId,
        version: (version ?? 0) + 1,
        query: editQuery,
        contextItems: editContextItems,
        modelInfo: editModelInfo,
        selectedSkill: skill,
        tplConfig,
        projectId: finalProjectId,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );
    setEditMode(false);
  }, [
    resultId,
    editQuery,
    editModelInfo,
    editContextItems,
    skill,
    version,
    canvasId,
    getNodes,
    getEdges,
    addEdges,
    deleteElements,
    invokeAction,
    setEditMode,
    formErrors,
    t,
    form,
    getFinalProjectId,
  ]);

  const handleSelectSkill = useCallback(
    (skill: Skill) => {
      setLocalActionMeta({
        icon: skill.icon,
        name: skill.name,
      });

      // Reset form when skill changes
      if (skill.configSchema?.items?.length > 0) {
        const newConfig = {};

        // Process each item in the schema to create default values
        for (const item of skill.configSchema.items) {
          if (item.defaultValue !== undefined) {
            newConfig[item.key] = {
              value: item.defaultValue,
              label: item.labelDict?.en ?? item.key,
              displayValue: String(item.defaultValue),
            };
          }
        }

        form.setFieldValue('tplConfig', newConfig);
      } else {
        form.setFieldValue('tplConfig', undefined);
      }
    },
    [form],
  );

  const handleImageUpload = async (file: File) => {
    const nodeData = await uploadImageHook(file, canvasId);
    if (nodeData) {
      setEditContextItems([
        ...(contextItemsRef.current || []),
        {
          type: 'image',
          ...nodeData,
        },
      ]);
    }
  };

  const handleMultipleImagesUpload = async (files: File[]) => {
    const nodesData = await uploadMultipleImagesHook(files, canvasId);
    if (nodesData?.length) {
      const newContextItems = nodesData.map((nodeData) => ({
        type: 'image' as const,
        ...nodeData,
      }));

      setEditContextItems([...editContextItems, ...newContextItems]);
    }
  };

  const [mcpSelectorOpen, setMcpSelectorOpen] = useState<boolean>(false);

  // Toggle MCP selector panel
  const handleMcpSelectorToggle = useCallback(() => {
    setMcpSelectorOpen(!mcpSelectorOpen);
  }, [mcpSelectorOpen, setMcpSelectorOpen]);

  // 获取选择的 MCP 服务器
  const { selectedMcpServers } = useLaunchpadStoreShallow((state) => ({
    selectedMcpServers: state.selectedMcpServers,
  }));

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: (
          <Badge
            count={selectedMcpServers.length > 0 ? selectedMcpServers.length : 0}
            size="small"
            offset={[2, -2]}
          >
            <ToolOutlined className="flex items-center" />
          </Badge>
        ),
        title: t('copilot.chatActions.chooseMcp'),
        onClick: () => {
          handleMcpSelectorToggle();
        },
      },
      {
        icon: <GrRevert className="flex items-center" />,
        title: t('copilot.chatActions.discard'),
        onClick: () => {
          setEditMode(false);
          setEditQuery(query);
          setEditContextItems(contextItems);
          setEditModelInfo(modelInfo);
          setEditRuntimeConfig(runtimeConfig);

          // Reset form values
          if (initialTplConfig) {
            form.setFieldValue('tplConfig', initialTplConfig);
          }
        },
      },
    ],
    [
      handleMcpSelectorToggle,
      t,
      selectedMcpServers,
      setEditMode,
      contextItems,
      query,
      modelInfo,
      t,
      form,
      initialTplConfig,
    ],
  );

  if (!enabled) {
    return null;
  }

  return (
    <div className="ai-copilot-chat-container">
      <div className={cn('border border-solid border-gray-200 dark:border-gray-700 rounded-lg')}>
        <McpSelectorPanel isOpen={mcpSelectorOpen} onClose={() => setMcpSelectorOpen(false)} />

        {!hideSelectedSkillHeader && (
          <SelectedSkillHeader
            readonly={readonly}
            skill={{
              icon: localActionMeta?.icon,
              name: localActionMeta?.name,
            }}
            className="rounded-t-[7px]"
            onClose={() => {
              setLocalActionMeta(null);
            }}
          />
        )}
        <ContextManager
          className="p-2 px-3"
          contextItems={editContextItems}
          setContextItems={setEditContextItems}
        />
        <div className="px-3">
          <ChatInput
            ref={textareaRef}
            readonly={canvasReadonly}
            query={editQuery}
            setQuery={setEditQuery}
            selectedSkillName={localActionMeta?.name}
            handleSendMessage={handleSendMessage}
            handleSelectSkill={(skill) => {
              setEditQuery(editQuery?.slice(0, -1));
              handleSelectSkill(skill);
            }}
            onUploadImage={handleImageUpload}
            onUploadMultipleImages={handleMultipleImagesUpload}
          />
        </div>

        {skill?.configSchema?.items?.length > 0 && (
          <div className="px-3">
            <ConfigManager
              readonly={canvasReadonly}
              key={skill?.name}
              form={form}
              formErrors={formErrors}
              setFormErrors={setFormErrors}
              schema={skill?.configSchema}
              tplConfig={initialTplConfig}
              fieldPrefix="tplConfig"
              configScope="runtime"
              resetConfig={() => {
                // Reset to skill's tplConfig if available, otherwise create a new default config
                if (skill?.tplConfig) {
                  form.setFieldValue('tplConfig', skill.tplConfig);
                } else {
                  const defaultConfig = {};
                  for (const item of skill?.configSchema?.items || []) {
                    if (item.defaultValue !== undefined) {
                      defaultConfig[item.key] = {
                        value: item.defaultValue,
                        label: item.labelDict?.en ?? item.key,
                        displayValue: String(item.defaultValue),
                      };
                    }
                  }
                  form.setFieldValue('tplConfig', defaultConfig);
                }
              }}
            />
          </div>
        )}

        <ChatActions
          className="p-2 px-3"
          query={editQuery}
          model={editModelInfo}
          setModel={setEditModelInfo}
          runtimeConfig={editRuntimeConfig}
          setRuntimeConfig={setEditRuntimeConfig}
          handleSendMessage={handleSendMessage}
          handleAbort={() => {}}
          customActions={customActions}
          onUploadImage={handleImageUpload}
          contextItems={editContextItems}
          form={form}
        />
      </div>
    </div>
  );
};

const arePropsEqual = (prevProps: EditChatInputProps, nextProps: EditChatInputProps) => {
  return (
    prevProps.enabled === nextProps.enabled &&
    prevProps.resultId === nextProps.resultId &&
    prevProps.query === nextProps.query &&
    prevProps.modelInfo === nextProps.modelInfo &&
    prevProps.readonly === nextProps.readonly &&
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.actionMeta?.name === nextProps.actionMeta?.name &&
    prevProps.tplConfig === nextProps.tplConfig
  );
};

export const EditChatInput = memo(EditChatInputComponent, arePropsEqual);
