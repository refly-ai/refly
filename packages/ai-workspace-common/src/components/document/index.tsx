import { useEffect, useState, memo, useCallback, useRef, useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import { useSearchParams } from 'react-router-dom';

import './index.scss';
import { Button, message, Tooltip, Input, Form } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import {
  IconCopy,
  IconLock,
  IconUnlock,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import {
  useDocumentStoreShallow,
  useLaunchpadStoreShallow,
  useUserStoreShallow,
} from '@refly/stores';
import { AiChat } from 'refly-icons';
import { motion, AnimatePresence } from 'motion/react';

import { CollaborativeEditor } from './collab-editor';
import { ReadonlyEditor } from './readonly-editor';
import {
  DocumentProvider,
  useDocumentContext,
} from '@refly-packages/ai-workspace-common/context/document';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { ydoc2Markdown } from '@refly/utils/editor';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useDocumentSync } from '@refly-packages/ai-workspace-common/hooks/use-document-sync';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { editorEmitter } from '@refly/utils/event-emitter/editor';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useSiderStoreShallow } from '@refly/stores';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { genActionResultID } from '@refly/utils';
import { IContextItem } from '@refly/common-types';
import {
  ModelInfo,
  SkillRuntimeConfig,
  SkillTemplateConfig,
  Skill,
  GenericToolset,
} from '@refly/openapi-schema';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';

// Define the table of contents item type
interface TocItem {
  id: string;
  text: string;
  level: number;
  element: HTMLElement;
  isActive?: boolean;
  index?: string; // For displaying numbering of toc items
  parentIndex?: number; // To determine parent toc item
}

// Simplified TOC component
const DocumentToc = memo(() => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TocItem[]>([]);

  // Handle TOC item click
  const handleTocItemClick = (item: TocItem) => {
    if (item.element) {
      item.element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Process TOC items hierarchy and numbering
  const processTocItems = (tocItems: TocItem[]): TocItem[] => {
    return tocItems.map((item) => {
      return {
        ...item,
        index: '',
      };
    });
  };

  // Extract headings from document
  useEffect(() => {
    const extractHeadings = () => {
      // Find editor container
      const editorContent = document.querySelector('.ai-note-editor-content-container');
      if (!editorContent) return;

      // Find all heading elements
      const headings = editorContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length === 0) {
        setItems([]);
        return;
      }

      const tocItems: TocItem[] = [];

      headings.forEach((heading, index) => {
        const element = heading as HTMLElement;
        const level = Number.parseInt(element.tagName.substring(1), 10);
        const text = element.textContent || '';
        const id = `toc-heading-${index}`;

        // Set ID for navigation
        element.id = id;

        tocItems.push({
          id,
          text,
          level,
          element,
          isActive: false,
        });
      });

      // Process TOC hierarchy and numbering
      const processedItems = processTocItems(tocItems);
      setItems(processedItems);
    };

    // Wait for DOM to complete loading
    setTimeout(extractHeadings);
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="w-60 border-l border-gray-200">
      <div className="toc-container">
        <div className="text-lg">{t('document.tableOfContents', 'Table of contents')}</div>
        <div className="toc-list">
          {items.map((item) => (
            <div
              key={item.id}
              className={`toc-item cursor-pointer ${item.isActive ? 'active' : ''}`}
              data-level={item.level}
              onClick={() => handleTocItemClick(item)}
            >
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

const StatusBar = memo(
  ({ docId }: { docId: string }) => {
    const { provider, ydoc } = useDocumentContext();

    const { t, i18n } = useTranslation();
    const language = i18n.language as LOCALE;

    const [unsyncedChanges, setUnsyncedChanges] = useState(provider?.unsyncedChanges || 0);
    const [debouncedUnsyncedChanges] = useDebounce(unsyncedChanges, 500);

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

    const { selectedToolsets: selectedToolsetsFromStore } = useLaunchpadStoreShallow((state) => ({
      selectedToolsets: state.selectedToolsets,
    }));
    const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>(
      selectedToolsetsFromStore ?? [],
    );

    // Add hooks for AI functionality
    const { invokeAction } = useInvokeAction();
    const { addNode } = useAddNode();
    const { getFinalProjectId } = useAskProject();
    const { readonly, canvasId } = useCanvasContext();
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
        !followUpActionMeta ||
        followUpActionMeta?.name === 'commonQnA' ||
        !followUpActionMeta?.name,
      [followUpActionMeta],
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

    const handleUnsyncedChanges = useCallback((data: number) => {
      setUnsyncedChanges(data);
    }, []);

    useEffect(() => {
      provider?.on('unsyncedChanges', handleUnsyncedChanges);
      return () => {
        provider?.off('unsyncedChanges', handleUnsyncedChanges);
      };
    }, [provider, handleUnsyncedChanges]);

    const { config, setDocumentReadOnly } = useDocumentStoreShallow((state) => ({
      config: state.config[docId],
      setDocumentReadOnly: state.setDocumentReadOnly,
    }));
    const readOnly = config?.readOnly;

    useEffect(() => {
      if (ydoc) {
        const yReadOnly = ydoc?.getText('readOnly');
        setDocumentReadOnly(docId, yReadOnly?.toJSON() === 'true');

        const observer = () => {
          if (provider?.status === 'connected') {
            setDocumentReadOnly(docId, yReadOnly?.toJSON() === 'true');
          }
        };
        yReadOnly?.observe(observer);

        return () => {
          yReadOnly?.unobserve(observer);
        };
      }
    }, [ydoc, docId, setDocumentReadOnly, provider?.status]);

    const toggleReadOnly = () => {
      if (!ydoc || provider?.status !== 'connected') {
        message.error(t('knowledgeBase.note.connectionError') || 'Connection error');
        return;
      }

      try {
        ydoc.transact(() => {
          const yReadOnly = ydoc.getText('readOnly');
          if (!yReadOnly) return;

          yReadOnly.delete(0, yReadOnly.length ?? 0);
          yReadOnly.insert(0, (!readOnly).toString());
        });

        setDocumentReadOnly(docId, !readOnly);

        readOnly
          ? message.success(t('knowledgeBase.note.edit'))
          : message.warning(t('knowledgeBase.note.readOnly'));
      } catch (error) {
        console.error('Transaction error when toggling read-only:', error);

        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn('Database connection is closing. Transaction aborted.');
          message.error(t('knowledgeBase.note.databaseError') || 'Database connection error');
        }
      }
    };

    const handleCopy = () => {
      const title = ydoc.getText('title').toJSON();
      const content = ydoc2Markdown(ydoc);
      copyToClipboard(`# ${title}\n\n${content}`);
      message.success({ content: t('contentDetail.item.copySuccess') });
    };

    // Initialize context items with current document when showing input
    const initializeFollowUpInput = useCallback(() => {
      if (docId) {
        const currentDocumentContext: IContextItem = {
          type: 'document',
          entityId: docId,
          title: ydoc?.getText('title')?.toJSON() || '',
        };
        setFollowUpContextItems([currentDocumentContext]);
      }

      // Set default model if available
      const defaultProviderItem = providerItemList?.data?.find((item) => item.category === 'llm');
      if (defaultProviderItem) {
        const modelInfo: ModelInfo = {
          name: (defaultProviderItem.config as any)?.modelId || defaultProviderItem.name,
          label: defaultProviderItem.name,
          provider: defaultProviderItem.provider?.name || '',
          providerItemId: defaultProviderItem.itemId,
          contextLimit: (defaultProviderItem.config as any)?.contextLimit || 0,
          maxOutput: (defaultProviderItem.config as any)?.maxOutput || 0,
          capabilities: (defaultProviderItem.config as any)?.capabilities || {},
        };
        setFollowUpModelInfo(modelInfo);
      }

      setShowFollowUpInput(!showFollowUpInput);
    }, [docId, ydoc, providerItemList, showFollowUpInput]);

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
        (providerItemList?.data?.find((item) => item.category === 'llm')
          ? {
              name:
                (providerItemList.data.find((item) => item.category === 'llm')?.config as any)
                  ?.modelId || providerItemList.data.find((item) => item.category === 'llm')?.name,
              label: providerItemList.data.find((item) => item.category === 'llm')?.name,
              provider:
                providerItemList.data.find((item) => item.category === 'llm')?.provider?.name || '',
              providerItemId: providerItemList.data.find((item) => item.category === 'llm')?.itemId,
              contextLimit:
                (providerItemList.data.find((item) => item.category === 'llm')?.config as any)
                  ?.contextLimit || 0,
              maxOutput:
                (providerItemList.data.find((item) => item.category === 'llm')?.config as any)
                  ?.maxOutput || 0,
              capabilities:
                (providerItemList.data.find((item) => item.category === 'llm')?.config as any)
                  ?.capabilities || {},
            }
          : undefined);

      // Invoke the action
      invokeAction(
        {
          query: followUpQuery,
          resultId,
          selectedToolsets,
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

      // Add node to canvas with connection to the current document
      const connectTo = docId
        ? [
            {
              type: 'document' as const,
              entityId: docId,
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
              selectedToolsets,
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
      docId,
      followUpModelInfo,
      followUpRuntimeConfig,
      followUpContextItems,
      followUpSkill,
      followUpTplConfig,
      formErrors,
      invokeAction,
      addNode,
      providerItemList,
      getFinalProjectId,
      form,
      t,
      selectedToolsets,
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

    return (
      <div className="w-full border-x-0 border-b-0 border-t-[1px] border-solid border-refly-Card-Border">
        {/* Follow-up question input with full functionality and animation */}
        {!readonly && (
          <div className="flex flex-row items-center justify-between bg-refly-tertiary-default px-3 py-2 rounded-xl mx-3 mt-1">
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
        )}
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
                    selectedToolsets={selectedToolsets}
                    setSelectedToolsets={setSelectedToolsets}
                  />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status bar with follow-up button */}
        <div className="h-10 p-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-1">
            <Tooltip
              placement="bottom"
              title={
                readOnly
                  ? t('document.enableEdit', 'Enable editing')
                  : t('document.setReadOnly', 'Set to read-only')
              }
            >
              <Button
                type="text"
                icon={
                  readOnly ? (
                    <IconLock className="text-green-500" />
                  ) : (
                    <IconUnlock className="text-gray-500" />
                  )
                }
                onClick={() => toggleReadOnly()}
              />
            </Tooltip>
            <Tooltip placement="bottom" title={t('common.copy.title')}>
              <Button
                type="text"
                icon={<IconCopy className="text-gray-500" />}
                onClick={() => handleCopy()}
                title={t('common.copy.title')}
              />
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`
                    relative w-2.5 h-2.5 rounded-full
                    transition-colors duration-700 ease-in-out
                    ${debouncedUnsyncedChanges > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-400'}
                  `}
            />
            <div className="text-xs text-refly-text-1">
              {debouncedUnsyncedChanges > 0
                ? t('canvas.toolbar.syncingChanges')
                : t('canvas.toolbar.synced', {
                    time: time(new Date(), language)?.utc()?.fromNow(),
                  })}
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.docId === nextProps.docId;
  },
);

const DocumentEditorHeader = memo(
  ({ docId, readonly }: { docId: string; readonly?: boolean }) => {
    const { t } = useTranslation();
    const { projectId } = useGetProjectCanvasId();
    const { document } = useDocumentStoreShallow((state) => ({
      document: state.data[docId]?.document,
    }));
    const { sourceList, setSourceList } = useSiderStoreShallow((state) => ({
      sourceList: state.sourceList,
      setSourceList: state.setSourceList,
    }));
    const { syncTitleToYDoc } = useDocumentSync();

    const setNodeDataByEntity = useSetNodeDataByEntity();

    const onTitleChange = (newTitle: string) => {
      syncTitleToYDoc(newTitle);
      setNodeDataByEntity(
        {
          entityId: docId,
          type: 'document',
        },
        {
          title: newTitle,
        },
      );

      if (projectId) {
        const source = sourceList.find((s) => s.id === docId);
        if (source) {
          setSourceList(sourceList.map((s) => (s.id === docId ? { ...s, title: newTitle } : s)));
        }
      }
    };

    useEffect(() => {
      const handleSyncTitle = (data: { docId: string; title: string }) => {
        if (data.docId === docId) {
          syncTitleToYDoc(data.title);
        }
      };

      editorEmitter.on('syncDocumentTitle', handleSyncTitle);

      return () => {
        editorEmitter.off('syncDocumentTitle', handleSyncTitle);
      };
    }, [docId, syncTitleToYDoc]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      // Skip custom handling when IME composition is in progress
      if (e.nativeEvent.isComposing || e.key === 'Process') {
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        editorEmitter.emit('insertBelow', '\n');
      }
    }, []);

    return (
      <div className="w-full">
        <div className="mx-0 mt-4 max-w-screen-lg">
          <Input
            readOnly={readonly}
            className="document-title !text-3xl font-bold bg-transparent !border-none focus:!bg-transparent  hover:bg-gray-50 dark:hover:bg-white/10"
            placeholder={t('editor.placeholder.title')}
            value={document?.title}
            style={{ paddingLeft: 6 }}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.docId === nextProps.docId,
);

const DocumentBody = memo(
  ({ docId }: { docId: string }) => {
    const { t } = useTranslation();
    const { readonly, isLoading, isShareDocumentLoading, provider, ydoc } = useDocumentContext();
    const [searchParams] = useSearchParams();
    const isMaximized = searchParams.get('isMaximized') === 'true';

    const { config } = useDocumentStoreShallow((state) => ({
      config: state.config[docId],
    }));
    const hasDocumentSynced = config?.remoteSyncedAt > 0 && config?.localSyncedAt > 0;
    const isStillLoading = (isLoading && !hasDocumentSynced) || provider?.status !== 'connected';

    useEffect(() => {
      const onShare = async () => {
        if (!ydoc) return;
        const loadingMessage = message.loading(t('document.sharing', 'Sharing document...'), 0);
        try {
          const title = ydoc.getText('title').toJSON();
          const content = ydoc2Markdown(ydoc);
          const documentData = { title, content };
          const { data, error } = await getClient().createShare({
            body: {
              entityId: docId,
              entityType: 'document',
              shareData: JSON.stringify(documentData),
            },
          });
          if (!data?.success || error) {
            throw new Error(error ? String(error) : 'Failed to share document');
          }
          const shareLink = getShareLink('document', data.data?.shareId ?? '');
          copyToClipboard(shareLink);
          loadingMessage();
          message.success(
            t('document.shareSuccess', 'Document shared successfully! Link copied to clipboard.'),
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to share document:', err);
          loadingMessage();
          message.error(t('document.shareError', 'Failed to share document'));
        } finally {
          editorEmitter.emit('shareDocumentCompleted');
        }
      };
      editorEmitter.on('shareDocument', onShare);
      return () => {
        editorEmitter.off('shareDocument', onShare);
      };
    }, [docId, t, ydoc]);

    return (
      <div className="overflow-auto flex-grow">
        <Spin
          className="document-editor-spin"
          tip={t('knowledgeBase.note.connecting')}
          spinning={readonly ? isShareDocumentLoading : isStillLoading}
          style={{ height: '100%', width: '100%' }}
        >
          <div className="ai-note-editor">
            <div className="ai-note-editor-container">
              <DocumentEditorHeader docId={docId} readonly={readonly} />

              <div className="flex flex-row w-full">
                <div className={`flex-1 w-full ${isMaximized ? 'mr-4' : ''}`}>
                  {readonly ? (
                    <ReadonlyEditor docId={docId} />
                  ) : (
                    <CollaborativeEditor docId={docId} />
                  )}
                </div>
                {isMaximized && <DocumentToc />}
              </div>
            </div>
          </div>
        </Spin>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.docId === nextProps.docId,
);

export const DocumentEditor = memo(
  ({
    docId,
    shareId,
    readonly,
  }: { docId: string; shareId?: string; readonly?: boolean; _isMaximized?: boolean }) => {
    const { resetState } = useDocumentStoreShallow((state) => ({
      resetState: state.resetState,
    }));
    const { readonly: canvasReadOnly } = useCanvasContext();

    useEffect(() => {
      return () => {
        resetState(docId);
      };
    }, []);

    return (
      <DocumentProvider docId={docId} shareId={shareId} readonly={readonly}>
        <div className="flex flex-col ai-note-container">
          <DocumentBody docId={docId} />
          {!canvasReadOnly && <StatusBar docId={docId} />}
        </div>
      </DocumentProvider>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.docId === nextProps.docId && prevProps._isMaximized === nextProps._isMaximized;
  },
);
