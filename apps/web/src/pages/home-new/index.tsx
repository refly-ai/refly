import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skill } from '@refly/openapi-schema';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { useFrontPageStoreShallow } from '@refly-packages/ai-workspace-common/stores/front-page';
import { SkillDisplay } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/skill-display';
import { getSkillIcon, IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Button, Form } from 'antd';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import { Actions } from '@refly-packages/ai-workspace-common/components/canvas/front-page/action';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { canvasTemplateEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import Header from '@/components/landing-page-partials/Header';

import cn from 'classnames';
import { Title } from '@refly-packages/ai-workspace-common/components/canvas/front-page/title';

const UnsignedFrontPage = memo(() => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        background:
          'linear-gradient(124deg,rgba(31,201,150,0.1) 0%,rgba(69,190,255,0.06) 24.85%),#f3f3f3',
      }}
    >
      <Header />

      <div className="w-full h-full pt-2 overflow-y-auto" id="front-page-scrollable-div">
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
                    handleAbort={() => {}}
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
        </div>
      </div>
    </div>
  );
});

UnsignedFrontPage.displayName = 'UnsignedFrontPage';

export default UnsignedFrontPage;
