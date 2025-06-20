import { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Skill } from '@refly/openapi-schema';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { useFrontPageStoreShallow } from '@refly-packages/ai-workspace-common/stores/front-page';
import { SkillDisplay } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/skill-display';
import { getSkillIcon, IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Button, Form } from 'antd';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import { Actions } from '@refly-packages/ai-workspace-common/components/canvas/front-page/action';
import { useListSkills } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { canvasTemplateEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { AnimatedGridPattern } from '@refly-packages/ai-workspace-common/components/magicui/animated-grid-pattern';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import Header from '@/components/landing-page-partials/Header';
import SimpleFooter from '@/components/landing-page-partials/SimpleFooter';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';

import cn from 'classnames';
import { Title } from '@refly-packages/ai-workspace-common/components/canvas/front-page/title';

const UnsignedFrontPage = memo(() => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const skills = useListSkills();
  const templateLanguage = i18n.language;
  const templateCategoryId = '';

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

  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const { abortAction } = useInvokeAction();

  const handleSelectSkill = useCallback(
    (skill: Skill | null) => {
      setSelectedSkill(skill);
      setTplConfig(skill?.tplConfig ?? null);
    },
    [setSelectedSkill, setTplConfig],
  );

  const handleLogin = useCallback(() => {
    setLoginModalOpen(true);
  }, [setLoginModalOpen]);

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

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div className="relative h-full overflow-hidden bg-white">
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
      <Header />

      <div
        className="w-full h-full pt-20 bg-white overflow-y-auto dark:bg-gray-900"
        id="front-page-scrollable-div"
      >
        <div className={cn('relative w-full h-full')}>
          <div
            className={cn(
              'p-6 max-w-4xl mx-auto z-10',
              canvasTemplateEnabled ? '' : 'flex flex-col justify-center',
            )}
          >
            <Title />

            <div className="w-full backdrop-blur-sm rounded-lg shadow-sm ring-1 ring-gray-200 mx-2 dark:ring-gray-600">
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
                  containCnt={5}
                  selectedSkill={selectedSkill}
                  setSelectedSkill={handleSelectSkill}
                />

                <div className="flex flex-col">
                  <ChatInput
                    readonly={false}
                    query={query}
                    setQuery={setQuery}
                    selectedSkillName={selectedSkill?.name ?? null}
                    handleSendMessage={handleLogin}
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
                    model={null}
                    setModel={() => {}}
                    runtimeConfig={runtimeConfig}
                    setRuntimeConfig={setRuntimeConfig}
                    handleSendMessage={handleLogin}
                    handleAbort={abortAction}
                    customActions={[
                      {
                        icon: <IconPlus className="flex items-center justify-center" />,
                        title: '',
                        content: t('loggedHomePage.siderMenu.newCanvas'),
                        onClick: handleLogin,
                      },
                    ]}
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
                    <h3 className="text-base font-medium dark:text-gray-100">
                      {t('frontPage.fromCommunity')}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      {t('frontPage.fromCommunityDesc')}
                    </p>
                  </div>
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

          <SimpleFooter />
        </div>
      </div>
    </div>
  );
});

UnsignedFrontPage.displayName = 'UnsignedFrontPage';

export default UnsignedFrontPage;
