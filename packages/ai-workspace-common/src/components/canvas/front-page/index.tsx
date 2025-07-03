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
import { Actions } from './action';
import { useChatStore, useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useListSkills } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { PremiumBanner } from '@refly-packages/ai-workspace-common/components/canvas/node-chat-panel';
import {
  canvasTemplateEnabled,
  subscriptionEnabled,
} from '@refly-packages/ai-workspace-common/utils/env';
import { useCanvasTemplateModalShallow } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';
import { AnimatedGridPattern } from '@refly-packages/ai-workspace-common/components/magicui/animated-grid-pattern';
import { McpSelectorPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';
import { Title } from './title';
import { useAbortAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-abort-action';
import cn from 'classnames';

export const FrontPage = memo(({ projectId }: { projectId: string | null }) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [mcpSelectorOpen, setMcpSelectorOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const skills = useListSkills();
  const templateLanguage = i18n.language;
  const templateCategoryId = '';

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const { skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
    setSkillSelectedModel: state.setSkillSelectedModel,
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
    const { isPilotActivated } = useChatStore.getState();
    debouncedCreateCanvas('front-page', { isPilotActivated });
  }, [query, debouncedCreateCanvas]);

  const handleAbort = useCallback(() => {
    setIsExecuting(false);
    abortAction();
  }, [abortAction]);

  useEffect(() => {
    if (!isCreating && isExecuting) {
      setIsExecuting(false);
    }
  }, [isCreating, isExecuting]);

  const findSkillByName = useCallback(
    (name: string) => {
      return skills.find((skill) => skill.name === name) ?? null;
    },
    [skills],
  );

  const handlePresetScenario = useCallback(
    (scenarioId: string, skillName: string, queryText: string) => {
      setActiveScenarioId(scenarioId);
      const skill = findSkillByName(skillName);
      if (skill) {
        handleSelectSkill(skill);
        setQuery(queryText);
      }
    },
    [findSkillByName, handleSelectSkill, setQuery],
  );

  // Define preset scenarios
  const presetScenarios = useMemo(
    () => [
      {
        id: 'ppt',
        title: t('canvas.presetScenarios.generatePPT'),
        description: t('canvas.presetScenarios.generatePPTDesc'),
        skillName: 'codeArtifacts',
        query: t('canvas.presetScenarios.generatePPTQuery'),
        icon: '📊',
      },
      {
        id: 'landing',
        title: t('canvas.presetScenarios.generateLanding'),
        description: t('canvas.presetScenarios.generateLandingDesc'),
        skillName: 'codeArtifacts',
        query: t('canvas.presetScenarios.generateLandingQuery'),
        icon: '🌐',
      },
      {
        id: 'xiaohongshu',
        title: t('canvas.presetScenarios.generateXHS'),
        description: t('canvas.presetScenarios.generateXHSDesc'),
        skillName: 'codeArtifacts',
        query: t('canvas.presetScenarios.generateXHSQuery'),
        icon: '📱',
      },
      {
        id: 'mediaContent',
        title: t('canvas.presetScenarios.generateMediaContent'),
        description: t('canvas.presetScenarios.generateMediaContentDesc'),
        skillName: 'generateDoc',
        query: t('canvas.presetScenarios.generateMediaContentQuery'),
        icon: '📝',
      },
    ],
    [t],
  );

  const handleViewAllTemplates = useCallback(() => {
    setCanvasTemplateModalVisible(true);
  }, [setCanvasTemplateModalVisible]);

  // Toggle MCP selector panel
  const handleMcpSelectorToggle = useCallback(() => {
    setMcpSelectorOpen(!mcpSelectorOpen);
  }, [mcpSelectorOpen]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div className="relative h-full overflow-hidden bg-white/90">
      <AnimatedGridPattern
        numSquares={20}
        maxOpacity={0.1}
        duration={3}
        repeatDelay={1}
        className={cn(
          '[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]',
          'skew-y-12',
        )}
      />
      <div
        className="w-full h-full flex bg-white/95 overflow-y-auto dark:bg-gray-900/95"
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
                        setActiveScenarioId(null);
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              )}

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
                  customActions={useMemo(
                    () => [
                      {
                        icon: (
                          <Badge
                            count={selectedMcpServers?.length || 0}
                            size="small"
                            offset={[2, -2]}
                          >
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
                  )}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 mx-2 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {presetScenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className={`group bg-white/90 backdrop-blur-sm rounded-md ring-1 dark:bg-gray-800/90 ${
                    activeScenarioId === scenario.id
                      ? 'ring-green-500 bg-green-50/90 dark:bg-green-900/20'
                      : 'ring-gray-200 dark:ring-gray-600'
                  } py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out 
                  hover:ring-green-400 hover:bg-green-50/90
                  dark:hover:bg-green-800/20 dark:hover:ring-green-500`}
                  onClick={() =>
                    handlePresetScenario(scenario.id, scenario.skillName, scenario.query)
                  }
                >
                  <div className="flex items-center mb-1">
                    <div className="text-2xl mr-2 transition-transform duration-200 ease-in-out">
                      {scenario.icon}
                    </div>
                    <h5 className="text-sm font-medium text-gray-800 dark:text-gray-100 transition-colors duration-200 group-hover:text-green-700 dark:group-hover:text-green-300">
                      {scenario.title}
                    </h5>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 transition-colors duration-200 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                    {scenario.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {canvasTemplateEnabled && (
            <div className="h-full flex flex-col mt-10">
              <div className="flex justify-between items-center pt-6 mx-2">
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
    </div>
  );
});

FrontPage.displayName = 'FrontPage';
