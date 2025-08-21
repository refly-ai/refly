import { useMemo, useCallback, memo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, message, Tooltip, Form } from 'antd';
import { AiChat, Data } from 'refly-icons';
import { ModelIcon } from '@lobehub/icons';
import {
  ActionResult,
  ActionStep,
  Source,
  ModelInfo,
  SkillRuntimeConfig,
  SkillTemplateConfig,
  Skill,
} from '@refly/openapi-schema';
import { CheckCircleOutlined, CopyOutlined, ImportOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { parseMarkdownCitationsAndCanvasTags, safeParseJSON } from '@refly/utils/parse';
import { useDocumentStoreShallow, useUserStoreShallow } from '@refly/stores';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { editorEmitter, EditorOperation } from '@refly/utils/event-emitter/editor';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genActionResultID } from '@refly/utils';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { IContextItem } from '@refly/common-types';

interface ActionContainerProps {
  step: ActionStep;
  result: ActionResult;
  nodeId?: string;
}

const buttonClassName = 'text-xs flex justify-center items-center h-6 px-1 rounded-lg';

const ActionContainerComponent = ({ result, step }: ActionContainerProps) => {
  const { t } = useTranslation();
  const { debouncedCreateDocument, isCreating } = useCreateDocument();
  const { readonly, canvasId } = useCanvasContext();
  const { hasEditorSelection, activeDocumentId } = useDocumentStoreShallow((state) => ({
    hasEditorSelection: state.hasEditorSelection,
    activeDocumentId: state.activeDocumentId,
  }));

  // Add state for follow-up question input with full functionality
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [followUpContextItems, setFollowUpContextItems] = useState<IContextItem[]>([]);
  const [followUpModelInfo, setFollowUpModelInfo] = useState<ModelInfo | null>(null);
  const [followUpRuntimeConfig, setFollowUpRuntimeConfig] = useState<SkillRuntimeConfig>({});
  const [followUpTplConfig, setFollowUpTplConfig] = useState<SkillTemplateConfig>({});
  const [followUpActionMeta, setFollowUpActionMeta] = useState<{
    name?: string;
    icon?: any;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Add hooks for AI functionality
  const { invokeAction } = useInvokeAction();
  const { addNode } = useAddNode();
  const { getFinalProjectId } = useAskProject();
  const {
    handleUploadImage: uploadImageHook,
    handleUploadMultipleImages: uploadMultipleImagesHook,
  } = useUploadImage();

  const textareaRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  // Add skill finding functionality
  const followUpSkill = useFindSkill(followUpActionMeta?.name);

  const hideSelectedSkillHeader = useMemo(
    () =>
      !followUpActionMeta || followUpActionMeta?.name === 'commonQnA' || !followUpActionMeta?.name,
    [followUpActionMeta],
  );

  const { title } = result ?? {};
  const isPending = result?.status === 'executing';

  // Check if we're in share mode by checking if resultId exists
  // This indicates a "proper" result vs a shared result that might be loaded from share data
  const isShareMode = !result.resultId;

  const sources = useMemo(
    () =>
      typeof step?.structuredData?.sources === 'string'
        ? safeParseJSON(step?.structuredData?.sources)
        : (step?.structuredData?.sources as Source[]),
    [step?.structuredData],
  );

  const editorActionList = useMemo(
    () => [
      {
        icon: <ImportOutlined style={{ fontSize: 14 }} />,
        key: 'insertBelow',
        enabled: step.content && activeDocumentId,
      },
      {
        icon: <CheckCircleOutlined style={{ fontSize: 14 }} />,
        key: 'replaceSelection',
        enabled: step.content && activeDocumentId && hasEditorSelection,
      },
    ],
    [step.content, activeDocumentId, hasEditorSelection],
  );

  const handleEditorOperation = useCallback(
    async (type: EditorOperation | 'createDocument', content: string) => {
      const parsedContent = parseMarkdownCitationsAndCanvasTags(content, sources);

      if (type === 'insertBelow' || type === 'replaceSelection') {
        editorEmitter.emit(type, parsedContent);
      } else if (type === 'createDocument') {
        await debouncedCreateDocument(title ?? '', content, {
          sourceNodeId: result.resultId,
          addToCanvas: true,
        });
      }
    },
    [sources, title, result.resultId, debouncedCreateDocument],
  );

  const handleCopyToClipboard = useCallback(
    (content: string) => {
      const parsedText = parseMarkdownCitationsAndCanvasTags(content, sources);
      copyToClipboard(parsedText || '');
      message.success(t('copilot.message.copySuccess'));
    },
    [sources, t],
  );

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const { data: providerItemList } = useListProviderItems({
    query: {
      category: 'llm',
      enabled: true,
      isGlobal: userProfile?.preferences?.providerMode === 'global',
    },
  });

  const tokenUsage = step?.tokenUsage?.[0];

  const providerItem = useMemo(() => {
    if (!tokenUsage || !providerItemList?.data) return null;

    // If providerItemId is provided, use it to find the provider item
    if (tokenUsage?.providerItemId) {
      return providerItemList?.data?.find((item) => item.itemId === tokenUsage?.providerItemId);
    }

    // Fallback to modelName if providerItemId is not provided
    return (
      providerItemList?.data?.find((item) => item.config?.modelId === tokenUsage?.modelName) || null
    );
  }, [providerItemList, tokenUsage]);

  // Initialize context items with current node when showing input
  const initializeFollowUpInput = useCallback(() => {
    if (result?.resultId) {
      const currentNodeContext: IContextItem = {
        type: 'skillResponse',
        entityId: result.resultId,
        title: result.title || '',
      };
      setFollowUpContextItems([currentNodeContext]);
    }

    // Set default model if available
    if (providerItem && providerItem.category === 'llm') {
      const modelInfo: ModelInfo = {
        name: (providerItem.config as any)?.modelId || providerItem.name,
        label: providerItem.name,
        provider: providerItem.provider?.name || '',
        providerItemId: providerItem.itemId,
        contextLimit: (providerItem.config as any)?.contextLimit || 0,
        maxOutput: (providerItem.config as any)?.maxOutput || 0,
        capabilities: (providerItem.config as any)?.capabilities || {},
      };
      setFollowUpModelInfo(modelInfo);
    }

    setShowFollowUpInput(!showFollowUpInput);
  }, [result, providerItem, showFollowUpInput]);

  // Add skill selection handler
  const handleFollowUpSelectSkill = useCallback(
    (skill: Skill) => {
      setFollowUpActionMeta({
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
        setFollowUpTplConfig(newConfig);
      } else {
        form.setFieldValue('tplConfig', undefined);
        setFollowUpTplConfig({});
      }
    },
    [form],
  );

  // Add handler for follow-up question
  const handleFollowUpSend = useCallback(() => {
    if (!followUpQuery?.trim() || !canvasId) return;

    // Check for form errors
    if (formErrors && Object.keys(formErrors).length > 0) {
      message.error(t('copilot.configManager.errorTip'));
      return;
    }

    const resultId = genActionResultID();
    const finalProjectId = getFinalProjectId();

    // Get tplConfig from form
    const tplConfig = form?.getFieldValue('tplConfig') || followUpTplConfig;

    // Use selected model or fallback to default
    const modelInfo =
      followUpModelInfo ||
      (providerItem && providerItem.category === 'llm'
        ? {
            name: (providerItem.config as any)?.modelId || providerItem.name,
            label: providerItem.name,
            provider: providerItem.provider?.name || '',
            providerItemId: providerItem.itemId,
            contextLimit: (providerItem.config as any)?.contextLimit || 0,
            maxOutput: (providerItem.config as any)?.maxOutput || 0,
            capabilities: (providerItem.config as any)?.capabilities || {},
          }
        : undefined);

    // Invoke the action
    invokeAction(
      {
        query: followUpQuery,
        resultId,
        selectedSkill: followUpSkill,
        modelInfo,
        tplConfig,
        runtimeConfig: followUpRuntimeConfig,
        contextItems: followUpContextItems,
        projectId: finalProjectId,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );

    // Add node to canvas with connection to the current node
    const connectTo = result?.resultId
      ? [
          {
            type: 'skillResponse' as const,
            entityId: result.resultId,
            handleType: 'source' as const,
          },
        ]
      : undefined;

    addNode(
      {
        type: 'skillResponse',
        data: {
          title: followUpQuery,
          entityId: resultId,
          metadata: {
            status: 'executing',
            selectedSkill: followUpSkill,
            modelInfo,
            runtimeConfig: followUpRuntimeConfig,
            tplConfig,
            structuredData: {
              query: followUpQuery,
            },
            projectId: finalProjectId,
          },
        },
      },
      connectTo,
    );

    // Clear input and hide input box
    setFollowUpQuery('');
    setFollowUpContextItems([]);
    setFollowUpModelInfo(null);
    setFollowUpRuntimeConfig({});
    setFollowUpTplConfig({});
    setFollowUpActionMeta(null);
    setFormErrors({});
    setShowFollowUpInput(false);
  }, [
    followUpQuery,
    canvasId,
    result?.resultId,
    followUpModelInfo,
    followUpRuntimeConfig,
    followUpContextItems,
    followUpSkill,
    followUpTplConfig,
    formErrors,
    invokeAction,
    addNode,
    providerItem,
    getFinalProjectId,
    form,
    t,
  ]);

  // Image upload handlers for follow-up
  const handleFollowUpImageUpload = useCallback(
    async (file: File) => {
      const nodeData = await uploadImageHook(file, canvasId);
      if (nodeData) {
        setFollowUpContextItems((prev) => [
          ...prev,
          {
            type: 'image',
            ...nodeData,
          },
        ]);
      }
    },
    [uploadImageHook, canvasId],
  );

  const handleFollowUpMultipleImagesUpload = useCallback(
    async (files: File[]) => {
      const nodesData = await uploadMultipleImagesHook(files, canvasId);
      if (nodesData?.length) {
        const newContextItems = nodesData.map((nodeData) => ({
          type: 'image' as const,
          ...nodeData,
        }));
        setFollowUpContextItems((prev) => [...prev, ...newContextItems]);
      }
    },
    [uploadMultipleImagesHook, canvasId],
  );

  if (isPending) {
    return null;
  }

  return (
    <div className="border-[1px] border-solid border-b-0 border-x-0 border-refly-Card-Border pt-3">
      <div className="flex flex-row items-center justify-between bg-refly-tertiary-default px-3 py-2 rounded-xl mx-3">
        <div className="flex flex-row items-center px-2">
          <span className="font-[600] pr-4">{t('canvas.nodeActions.nextStepSuggestions')}</span>
          <div
            className="bg-[#CDFFF1] border-[1px] border-solid border-refly-Card-Border hover:bg-[#CDFFF1] hover:border-refly-Card-Border px-2 py-1 rounded-lg flex items-center justify-center cursor-pointer"
            onClick={initializeFollowUpInput}
          >
            <AiChat className="w-4 h-4 mr-[2px]" color="#0E9F77" />
            <span className="text-[#0E9F77] font-[600] text-xs">
              {t('canvas.nodeActions.followUpQuestion')}
            </span>
          </div>
        </div>
      </div>

      {/* Follow-up question input with full functionality and animation */}
      <AnimatePresence>
        {showFollowUpInput && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
              scale: 0.95,
              y: -10,
            }}
            animate={{
              opacity: 1,
              height: 'auto',
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              height: 0,
              scale: 0.95,
              y: -10,
            }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1], // easeOutCubic
              height: {
                duration: 0.3,
              },
            }}
            className="mx-3 mt-2 overflow-hidden"
          >
            <div className="px-4 py-3 border-[1px] border-solid border-refly-primary-default rounded-[16px] flex flex-col gap-2">
              {!hideSelectedSkillHeader && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                >
                  <SelectedSkillHeader
                    readonly={readonly}
                    skill={{
                      icon: followUpActionMeta?.icon,
                      name: followUpActionMeta?.name,
                    }}
                    className="rounded-t-[7px]"
                    onClose={() => {
                      setFollowUpActionMeta(null);
                      form.setFieldValue('tplConfig', undefined);
                      setFollowUpTplConfig({});
                    }}
                  />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.2 }}
              >
                <ContextManager
                  contextItems={followUpContextItems}
                  setContextItems={setFollowUpContextItems}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.2 }}
              >
                <ChatInput
                  ref={textareaRef}
                  readonly={readonly}
                  query={followUpQuery}
                  setQuery={setFollowUpQuery}
                  selectedSkillName={followUpActionMeta?.name}
                  handleSendMessage={handleFollowUpSend}
                  handleSelectSkill={(skill) => {
                    setFollowUpQuery(followUpQuery?.slice(0, -1));
                    handleFollowUpSelectSkill(skill);
                  }}
                  onUploadImage={handleFollowUpImageUpload}
                  onUploadMultipleImages={handleFollowUpMultipleImagesUpload}
                  placeholder={t('canvas.nodeActions.nextStepSuggestionsDescription')}
                />
              </motion.div>

              {followUpSkill?.configSchema?.items?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.175, duration: 0.2 }}
                >
                  <ConfigManager
                    readonly={readonly}
                    key={followUpSkill?.name}
                    form={form}
                    formErrors={formErrors}
                    setFormErrors={setFormErrors}
                    schema={followUpSkill?.configSchema}
                    tplConfig={followUpTplConfig}
                    fieldPrefix="tplConfig"
                    configScope="runtime"
                    resetConfig={() => {
                      // Reset to skill's tplConfig if available, otherwise create a new default config
                      if (followUpSkill?.tplConfig) {
                        form.setFieldValue('tplConfig', followUpSkill.tplConfig);
                        setFollowUpTplConfig(followUpSkill.tplConfig);
                      } else {
                        const defaultConfig = {};
                        for (const item of followUpSkill?.configSchema?.items || []) {
                          if (item.defaultValue !== undefined) {
                            defaultConfig[item.key] = {
                              value: item.defaultValue,
                              label: item.labelDict?.en ?? item.key,
                              displayValue: String(item.defaultValue),
                            };
                          }
                        }
                        form.setFieldValue('tplConfig', defaultConfig);
                        setFollowUpTplConfig(defaultConfig);
                      }
                    }}
                  />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.2 }}
              >
                <ChatActions
                  query={followUpQuery}
                  model={followUpModelInfo}
                  setModel={setFollowUpModelInfo}
                  runtimeConfig={followUpRuntimeConfig}
                  setRuntimeConfig={setFollowUpRuntimeConfig}
                  handleSendMessage={handleFollowUpSend}
                  handleAbort={() => {}}
                  onUploadImage={handleFollowUpImageUpload}
                  contextItems={followUpContextItems}
                  form={form}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between p-3 rounded-b-xl">
        {tokenUsage && (
          <div className="flex flex-row text-gray-500 text-sm gap-3">
            <div className="flex items-center gap-1">
              <ModelIcon size={16} model={tokenUsage?.modelName} type="color" />
              {tokenUsage?.modelLabel || providerItem?.name}
            </div>
            <div className="flex items-center gap-1">
              <Data size={16} />
              {tokenUsage?.inputTokens + tokenUsage?.outputTokens}
            </div>
          </div>
        )}
        {!isPending && step?.content && (
          <div className="flex flex-row justify-between items-center text-sm">
            <div className="-ml-1 text-sm flex flex-row items-center gap-1">
              {!readonly && !isShareMode && step.content && (
                <Tooltip title={t('copilot.message.copy')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined style={{ fontSize: 14 }} />}
                    className={buttonClassName}
                    onClick={() => handleCopyToClipboard(step.content ?? '')}
                  />
                </Tooltip>
              )}
              {!readonly &&
                !isShareMode &&
                editorActionList.map((item) => (
                  <Tooltip key={item.key} title={t(`copilot.message.${item.key}`)}>
                    <Button
                      key={item.key}
                      size="small"
                      type="text"
                      className={buttonClassName}
                      icon={item.icon}
                      disabled={!item.enabled}
                      loading={isCreating}
                      onClick={() => {
                        const parsedText = parseMarkdownCitationsAndCanvasTags(
                          step.content ?? '',
                          sources,
                        );
                        handleEditorOperation(item.key as EditorOperation, parsedText || '');
                      }}
                    />
                  </Tooltip>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ActionContainer = memo(ActionContainerComponent, (prevProps, nextProps) => {
  return (
    prevProps.step === nextProps.step &&
    prevProps.result === nextProps.result &&
    prevProps.nodeId === nextProps.nodeId
  );
});
