import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Tooltip, Dropdown, Form, Badge } from 'antd';
import type { MenuProps } from 'antd';
import { SwapOutlined, ToolOutlined } from '@ant-design/icons';

import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ModelInfo, Skill, SkillRuntimeConfig, SkillTemplateConfig } from '@refly/openapi-schema';
import {
  ChatActions,
  CustomAction,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import {
  IContextItem,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useTranslation } from 'react-i18next';
import { IoClose } from 'react-icons/io5';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { cn } from '@refly/utils/cn';
import classNames from 'classnames';
import { ContextTarget } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { ProjectKnowledgeToggle } from '@refly-packages/ai-workspace-common/components/project/project-knowledge-toggle';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListSkills } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';

import './index.scss';
import { McpSelectorPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';
import { t } from 'i18next';

// Memoized Premium Banner Component
export const PremiumBanner = memo(() => {
  const { t } = useTranslation();
  const { showPremiumBanner, setShowPremiumBanner } = useLaunchpadStoreShallow((state) => ({
    showPremiumBanner: state.showPremiumBanner,
    setShowPremiumBanner: state.setShowPremiumBanner,
  }));
  const setSubscribeModalVisible = useSubscriptionStoreShallow(
    (state) => state.setSubscribeModalVisible,
  );

  const handleUpgrade = useCallback(() => {
    setSubscribeModalVisible(true);
  }, [setSubscribeModalVisible]);

  if (!showPremiumBanner) return null;

  return (
    <div className="flex items-center justify-between px-2 py-0.5 bg-gray-100 border-b dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 whitespace-nowrap">
          {t('copilot.premiumBanner.message')}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="text"
            size="small"
            className="text-xs text-green-600 px-1"
            onClick={handleUpgrade}
          >
            {t('copilot.premiumBanner.upgrade')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IoClose size={14} className="flex items-center justify-center" />}
            onClick={() => setShowPremiumBanner(false)}
            className="text-gray-400 hover:text-gray-500 flex items-center justify-center w-5 h-5 min-w-0 p-0"
          />
        </div>
      </div>
    </div>
  );
});

PremiumBanner.displayName = 'PremiumBanner';

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
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const skills = useListSkills();

    const menuItems: MenuProps['items'] = useMemo(() => {
      const defaultItem = {
        key: 'default',
        label: (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{t('canvas.skill.askAI')}</span>
            <span className="text-xs text-gray-500">{t('canvas.skill.askAIDescription')}</span>
          </div>
        ),
      };

      const skillItems = skills.map((skill) => ({
        key: skill.name,
        label: (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{t(`${skill.name}.name`, { ns: 'skill' })}</span>
            <span className="text-xs text-gray-500">
              {t(`${skill.name}.description`, { ns: 'skill' })}
            </span>
          </div>
        ),
      }));

      return [defaultItem, ...skillItems];
    }, [t, skills]);

    const handleMenuClick: MenuProps['onClick'] = useCallback(
      ({ key }) => {
        const selectedSkill =
          key === 'default' ? null : skills.find((skill) => skill.name === key) || null;
        setSelectedSkill(selectedSkill);
      },
      [skills, setSelectedSkill],
    );

    return (
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#6172F3] shadow-lg flex items-center justify-center flex-shrink-0">
            {getSkillIcon(selectedSkillName, 'w-4 h-4 text-white')}
          </div>

          <Tooltip
            title={
              isMac
                ? t('canvas.skill.switchSkillTooltipMac', {
                    shortcut: '⌘ + /',
                  })
                : t('canvas.skill.switchSkillTooltip', {
                    shortcut: 'Ctrl + /',
                  })
            }
          >
            <Dropdown
              menu={{
                items: menuItems,
                onClick: handleMenuClick,
              }}
              trigger={['click']}
              disabled={readonly}
              placement="bottomLeft"
              dropdownRender={(menu) => (
                <div style={{ minWidth: '240px', maxHeight: '300px', overflowY: 'auto' }}>
                  {menu}
                </div>
              )}
            >
              <Button
                type="text"
                className="py-0 px-1 border-none shadow-none hover:bg-transparent focus:bg-transparent"
                disabled={readonly}
              >
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">
                    {selectedSkillName
                      ? t(`${selectedSkillName}.name`, { ns: 'skill' })
                      : t('canvas.skill.askAI')}
                  </span>
                  <SwapOutlined className="text-gray-400" />
                </div>
              </Button>
            </Dropdown>
          </Tooltip>
        </div>
        {selectedSkillName && !readonly && (
          <Button
            type="text"
            size="small"
            className="p-0 px-1"
            onClick={() => {
              setSelectedSkill?.(null);
            }}
          >
            {t('common.cancel')}
          </Button>
        )}
      </div>
    );
  },
);

NodeHeader.displayName = 'NodeHeader';

export interface ChatPanelProps {
  readonly?: boolean;
  query: string;
  setQuery: (query: string) => void;
  selectedSkill: Skill | null;
  setSelectedSkill: (skill: Skill | null) => void;
  contextItems: IContextItem[];
  setContextItems: (items: IContextItem[]) => void;
  modelInfo: ModelInfo | null;
  setModelInfo: (modelInfo: ModelInfo | null) => void;
  runtimeConfig: SkillRuntimeConfig;
  setRuntimeConfig: (config: SkillRuntimeConfig) => void;
  tplConfig?: SkillTemplateConfig;
  setTplConfig?: (config: SkillTemplateConfig) => void;
  handleSendMessage: () => void;
  handleAbortAction: () => void;
  onInputHeightChange?: () => void;
  className?: string;
  mode?: 'node' | 'list';
  resultId?: string;
  projectId?: string;
  handleProjectChange?: (newProjectId: string) => void;
}

export const ChatPanel = memo(
  ({
    readonly = false,
    query,
    setQuery,
    selectedSkill,
    setSelectedSkill,
    contextItems = [],
    setContextItems,
    modelInfo,
    setModelInfo,
    runtimeConfig = {},
    setRuntimeConfig,
    tplConfig,
    setTplConfig,
    handleSendMessage,
    handleAbortAction,
    onInputHeightChange,
    className = '',
    mode = 'node',
    resultId,
    projectId,
    handleProjectChange,
  }: ChatPanelProps) => {
    const [form] = Form.useForm();
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const chatInputRef = useRef<HTMLDivElement>(null);
    const userProfile = useUserStoreShallow((state) => state.userProfile);
    const isList = mode === 'list';
    const { handleUploadImage, handleUploadMultipleImages } = useUploadImage();
    const { canvasId, readonly: canvasReadonly } = useCanvasContext();
    const contextItemsRef = useRef(contextItems);

    // Get setActiveResultId from context panel store
    const { setActiveResultId } = useContextPanelStoreShallow((state) => ({
      setActiveResultId: state.setActiveResultId,
    }));

    // Reset form when skill changes
    useEffect(() => {
      if (selectedSkill) {
        form.resetFields();
        setFormErrors({});
      }
    }, [selectedSkill, form, setFormErrors]);
    useEffect(() => {
      contextItemsRef.current = contextItems;
    }, [contextItems]);

    // Memoize initialTplConfig to prevent unnecessary recalculations
    const initialTplConfig = useMemo(() => {
      return tplConfig || selectedSkill?.tplConfig || {};
    }, [tplConfig, selectedSkill?.tplConfig]);

    const handleTplConfigChange = useCallback(
      (config: SkillTemplateConfig) => {
        if (setTplConfig && JSON.stringify(config) !== JSON.stringify(initialTplConfig)) {
          setTplConfig(config);
        }
      },
      [setTplConfig, initialTplConfig],
    );

    const handleImageUpload = useCallback(
      async (file: File) => {
        // Set as active when user interacts with this component
        if (resultId) {
          setActiveResultId(resultId);
        }

        const nodeData = await handleUploadImage(file, canvasId);
        if (nodeData) {
          setTimeout(() => {
            setContextItems([
              ...(contextItemsRef.current || []),
              {
                type: 'image',
                ...nodeData,
              },
            ]);
          }, 10);
        }
      },
      [contextItems, handleUploadImage, setContextItems, resultId, setActiveResultId],
    );

    const handleMultipleImagesUpload = useCallback(
      async (files: File[]) => {
        // Set as active when user interacts with this component
        if (resultId) {
          setActiveResultId(resultId);
        }

        if (handleUploadMultipleImages) {
          const nodesData = await handleUploadMultipleImages(files, canvasId);
          if (nodesData?.length) {
            setTimeout(() => {
              const newContextItems = nodesData.map((nodeData) => ({
                type: 'image' as const,
                ...nodeData,
              }));

              setContextItems([...contextItems, ...newContextItems]);
            }, 10);
          }
        } else {
          // Fallback to uploading one at a time if multiple uploader not provided
          const uploadPromises = files.map((file) => handleUploadImage(file, canvasId));
          const results = await Promise.all(uploadPromises);
          const validResults = results.filter(Boolean);

          if (validResults.length) {
            setTimeout(() => {
              const newContextItems = validResults.map((nodeData) => ({
                type: 'image' as const,
                ...nodeData,
              }));

              setContextItems([...contextItems, ...newContextItems]);
            }, 10);
          }
        }
      },
      [
        contextItems,
        handleUploadImage,
        handleUploadMultipleImages,
        setContextItems,
        resultId,
        setActiveResultId,
        canvasId,
      ],
    );

    // Handle input focus to set active resultId
    const handleInputFocus = useCallback(() => {
      if (resultId) {
        setActiveResultId(resultId);
      } else {
        setActiveResultId(ContextTarget.Global);
      }
    }, [resultId, setActiveResultId]);

    // Add useEffect for auto focus
    useEffect(() => {
      if (!readonly) {
        setTimeout(() => {
          if (chatInputRef.current) {
            const textArea = chatInputRef.current.querySelector('textarea');
            if (textArea) {
              textArea.focus();
              // Set active on initial focus
              handleInputFocus();
            }
          }
        }, 100);
      }
    }, [readonly, handleInputFocus]);

    // Handle send message with active resultId
    const handleMessageSend = useCallback(() => {
      // Set as active when sending a message
      if (resultId) {
        setActiveResultId(resultId);
      }
      handleSendMessage();
    }, [handleSendMessage, resultId, setActiveResultId]);

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
      ],
      [handleMcpSelectorToggle, t, selectedMcpServers],
    );

    const renderContent = () => (
      <>
        <ContextManager
          className={classNames({
            'py-2': isList,
          })}
          contextItems={contextItems}
          setContextItems={setContextItems}
        />

        <ChatInput
          readonly={canvasReadonly}
          ref={chatInputRef}
          query={query}
          setQuery={(value) => {
            setQuery(value);
            if (onInputHeightChange) {
              setTimeout(onInputHeightChange, 0);
            }
          }}
          selectedSkillName={selectedSkill?.name}
          inputClassName="px-1 py-0"
          maxRows={20}
          handleSendMessage={handleMessageSend}
          handleSelectSkill={(skill) => {
            setQuery(query?.slice(0, -1));
            setSelectedSkill(skill);
          }}
          onUploadImage={handleImageUpload}
          onUploadMultipleImages={handleMultipleImagesUpload}
          onFocus={handleInputFocus}
        />

        {selectedSkill?.configSchema?.items?.length && setTplConfig ? (
          <ConfigManager
            readonly={canvasReadonly}
            key={`${selectedSkill?.name}-${Object.keys(initialTplConfig).length}`}
            form={form}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            schema={selectedSkill?.configSchema}
            tplConfig={initialTplConfig}
            fieldPrefix="tplConfig"
            configScope="runtime"
            onExpandChange={(_expanded) => {
              if (onInputHeightChange) {
                setTimeout(onInputHeightChange, 0);
              }
            }}
            resetConfig={() => {
              // Use setTimeout to move outside of React's render cycle
              setTimeout(() => {
                const defaultConfig = selectedSkill?.tplConfig ?? {};
                form.setFieldValue('tplConfig', defaultConfig);
              }, 0);
            }}
            onFormValuesChange={(_, allValues) => {
              // Debounce form value changes to prevent cascading updates
              const newConfig = allValues.tplConfig;
              if (JSON.stringify(newConfig) !== JSON.stringify(initialTplConfig)) {
                handleTplConfigChange(newConfig);
              }
            }}
          />
        ) : null}

        <ChatActions
          customActions={customActions}
          className={classNames({
            'py-2': isList,
          })}
          query={query}
          model={modelInfo}
          setModel={setModelInfo}
          handleSendMessage={handleMessageSend}
          handleAbort={handleAbortAction}
          onUploadImage={handleImageUpload}
          contextItems={contextItems}
          runtimeConfig={runtimeConfig}
          setRuntimeConfig={setRuntimeConfig}
        />
      </>
    );

    if (isList) {
      return (
        <div className="relative w-full p-2" data-cy="launchpad-chat-panel">
          <div
            className={cn(
              'ai-copilot-chat-container chat-input-container rounded-[7px] overflow-hidden',
              'border border-gray-100 border-solid dark:border-gray-700',
            )}
          >
            <McpSelectorPanel isOpen={mcpSelectorOpen} onClose={() => setMcpSelectorOpen(false)} />

            <SelectedSkillHeader
              skill={selectedSkill}
              setSelectedSkill={setSelectedSkill}
              onClose={() => setSelectedSkill(null)}
            />
            {subscriptionEnabled && !userProfile?.subscription && <PremiumBanner />}
            <div className={cn('px-3')}>{renderContent()}</div>
          </div>
          <ProjectKnowledgeToggle
            className="!pb-0"
            currentProjectId={projectId}
            onProjectChange={handleProjectChange}
          />
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col gap-3 h-full p-3 box-border ${className} max-w-[1024px] mx-auto`}
      >
        <McpSelectorPanel isOpen={mcpSelectorOpen} onClose={() => setMcpSelectorOpen(false)} />

        <NodeHeader
          readonly={readonly}
          selectedSkillName={selectedSkill?.name}
          setSelectedSkill={setSelectedSkill}
        />
        {renderContent()}
        <ProjectKnowledgeToggle
          className="!pb-0 !pt-0"
          currentProjectId={projectId}
          onProjectChange={handleProjectChange}
        />
      </div>
    );
  },
);

ChatPanel.displayName = 'ChatPanel';
