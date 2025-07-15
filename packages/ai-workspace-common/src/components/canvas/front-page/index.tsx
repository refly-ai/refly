import { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Skill } from '@refly/openapi-schema';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useFrontPageStoreShallow } from '@refly-packages/ai-workspace-common/stores/front-page';
import { SkillDisplay } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/skill-display';
import {
  getSkillIcon,
  IconRight,
  IconPlus,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { Form, Button, Badge } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import { Actions, CustomAction } from './action';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { PremiumBanner } from '@refly-packages/ai-workspace-common/components/canvas/node-chat-panel';
import {
  canvasTemplateEnabled,
  subscriptionEnabled,
} from '@refly-packages/ai-workspace-common/utils/env';
import { useCanvasTemplateModalShallow } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';
import { McpSelectorPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';
import { Title } from './title';
import { useAbortAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-abort-action';
import cn from 'classnames';
import { MediaChatInput } from '@refly-packages/ai-workspace-common/components/canvas/nodes/media/media-input';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';

export const FrontPage = memo(({ projectId }: { projectId: string | null }) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [mcpSelectorOpen, setMcpSelectorOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const templateLanguage = i18n.language;
  const templateCategoryId = '';

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const { collapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
  }));

  const { skillSelectedModel, setSkillSelectedModel, chatMode } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
    setSkillSelectedModel: state.setSkillSelectedModel,
    chatMode: state.chatMode,
  }));

  // Get selected MCP servers
  const { selectedMcpServers } = useLaunchpadStoreShallow((state) => ({
    selectedMcpServers: state.selectedMcpServers,
  }));

  const {
    query,
    selectedSkill,
    setQuery,
    setSelectedSkill,
    tplConfig,
    setTplConfig,
    runtimeConfig,
    setRuntimeConfig,
    reset,
  } = useFrontPageStoreShallow((state) => ({
    query: state.query,
    selectedSkill: state.selectedSkill,
    setQuery: state.setQuery,
    setSelectedSkill: state.setSelectedSkill,
    tplConfig: state.tplConfig,
    setTplConfig: state.setTplConfig,
    runtimeConfig: state.runtimeConfig,
    setRuntimeConfig: state.setRuntimeConfig,
    reset: state.reset,
  }));

  const { debouncedCreateCanvas, isCreating } = useCreateCanvas({
    projectId,
    afterCreateSuccess: () => {
      // When canvas is created successfully, data is already in the store
      // No need to use localStorage anymore
    },
  });
  const { setVisible: setCanvasTemplateModalVisible } = useCanvasTemplateModalShallow((state) => ({
    setVisible: state.setVisible,
  }));

  const { abortAction } = useAbortAction();

  const handleSelectSkill = useCallback(
    (skill: Skill) => {
      setSelectedSkill(skill);
      setTplConfig(skill?.tplConfig ?? null);
    },
    [setSelectedSkill, setTplConfig],
  );

  const handleSendMessage = useCallback(() => {
    if (!query?.trim()) return;
    setIsExecuting(true);
    debouncedCreateCanvas('front-page', { isPilotActivated: chatMode === 'agent' });
  }, [query, debouncedCreateCanvas, chatMode]);

  const handleAbort = useCallback(() => {
    setIsExecuting(false);
    abortAction();
  }, [abortAction]);

  useEffect(() => {
    if (!isCreating && isExecuting) {
      setIsExecuting(false);
    }
  }, [isCreating, isExecuting]);

  const handleViewAllTemplates = useCallback(() => {
    setCanvasTemplateModalVisible(true);
  }, [setCanvasTemplateModalVisible]);

  // Toggle MCP selector panel
  const handleMcpSelectorToggle = useCallback(() => {
    setMcpSelectorOpen(!mcpSelectorOpen);
  }, [mcpSelectorOpen]);

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: (
          <Badge count={selectedMcpServers?.length || 0} size="small" offset={[2, -2]}>
            <ToolOutlined className="flex items-center" />
          </Badge>
        ),
        title: t('copilot.chatActions.chooseMcp'),
        content: t('copilot.chatActions.chooseMcp'),
        onClick: handleMcpSelectorToggle,
      },
      {
        icon: <IconPlus className="flex items-center justify-center" />,
        title: '',
        content: t('loggedHomePage.siderMenu.newCanvas'),
        onClick: () => debouncedCreateCanvas(),
      },
    ],
    [selectedMcpServers?.length, t, handleMcpSelectorToggle, debouncedCreateCanvas],
  );

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div
      className={cn(
        'h-full flex m-2 bg-white/95 overflow-y-auto dark:bg-gray-900/95 rounded-lg ring-1 ring-gray-200 dark:ring-gray-600',
        {
          'ml-0 shadow-sm': !collapse,
        },
      )}
      id="front-page-scrollable-div"
    >
      <div
        className={cn(
          'relative w-full h-full p-6 max-w-4xl mx-auto z-10',
          canvasTemplateEnabled ? '' : 'flex flex-col justify-center',
        )}
      >
        <Title />

        <div className="w-full backdrop-blur-sm rounded-lg shadow-sm ring-1 ring-gray-200 mx-2 dark:ring-gray-600 overflow-hidden">
          <McpSelectorPanel isOpen={mcpSelectorOpen} onClose={() => setMcpSelectorOpen(false)} />

          {subscriptionEnabled && !userProfile?.subscription && <PremiumBanner />}
          <div className="p-4">
            {selectedSkill && (
              <div className="flex w-full justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#6172F3] shadow-lg flex items-center justify-center flex-shrink-0">
                    {getSkillIcon(selectedSkill.name, 'w-4 h-4 text-white')}
                  </div>
                  <span className="text-sm font-medium leading-normal text-[rgba(0,0,0,0.8)] truncate dark:text-[rgba(225,225,225,0.8)]">
                    {t(`${selectedSkill.name}.name`, { ns: 'skill' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="text"
                    size="small"
                    onClick={() => {
                      handleSelectSkill(null);
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}

            {chatMode === 'media' ? (
              <MediaChatInput
                readonly={false}
                query={query}
                setQuery={setQuery}
                showChatModeSelector
              />
            ) : (
              <>
                <SkillDisplay
                  containCnt={7}
                  selectedSkill={selectedSkill}
                  setSelectedSkill={handleSelectSkill}
                />
                <div className="flex flex-col">
                  <ChatInput
                    readonly={false}
                    query={query}
                    setQuery={setQuery}
                    selectedSkillName={selectedSkill?.name ?? null}
                    handleSendMessage={handleSendMessage}
                    handleSelectSkill={handleSelectSkill}
                    maxRows={6}
                    inputClassName="px-3 py-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  {selectedSkill?.configSchema?.items?.length > 0 && (
                    <ConfigManager
                      readonly={false}
                      key={selectedSkill?.name}
                      form={form}
                      formErrors={formErrors}
                      setFormErrors={setFormErrors}
                      schema={selectedSkill?.configSchema}
                      tplConfig={tplConfig}
                      fieldPrefix="tplConfig"
                      configScope="runtime"
                      resetConfig={() => {
                        const defaultConfig = selectedSkill?.tplConfig ?? {};
                        setTplConfig(defaultConfig);
                        form.setFieldValue('tplConfig', defaultConfig);
                      }}
                      onFormValuesChange={(_changedValues, allValues) => {
                        setTplConfig(allValues.tplConfig);
                      }}
                    />
                  )}

                  <Actions
                    query={query}
                    model={skillSelectedModel}
                    setModel={setSkillSelectedModel}
                    runtimeConfig={runtimeConfig}
                    setRuntimeConfig={setRuntimeConfig}
                    handleSendMessage={handleSendMessage}
                    handleAbort={handleAbort}
                    loading={isCreating}
                    isExecuting={isExecuting}
                    customActions={customActions}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {canvasTemplateEnabled && (
          <div className="h-full flex flex-col mt-10">
            <div className="flex justify-between items-center mx-2">
              <div>
                <h3 className="text-base font-medium">{t('frontPage.fromCommunity')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('frontPage.fromCommunityDesc')}</p>
              </div>
              <Button
                type="text"
                size="small"
                className="text-xs text-gray-500 gap-1 !hover:text-green-500 transition-colors"
                onClick={handleViewAllTemplates}
              >
                {t('common.viewAll')} <IconRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex-1">
              <TemplateList
                source="front-page"
                scrollableTargetId="front-page-scrollable-div"
                language={templateLanguage}
                categoryId={templateCategoryId}
                className="!bg-transparent !px-0"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

FrontPage.displayName = 'FrontPage';
