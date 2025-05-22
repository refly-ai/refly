import { Layout, Button, Divider } from 'antd';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import { SiderLogo } from './layout';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import { LuCheck } from 'react-icons/lu';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  IconX,
  IconGithub,
  IconDiscord,
  IconEmail,
  IconLanguage,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { UILocaleList } from '@refly-packages/ai-workspace-common/components/ui-locale-list';
import { DownOutlined } from '@ant-design/icons';

export const SiderLoggedOut = (props: { source: 'sider' | 'popover' }) => {
  const { t } = useTranslation();
  const { source = 'sider' } = props;
  const navigate = useNavigate();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  // Key feature IDs for mapping through translations
  const keyFeatureIds = useMemo(
    () => [
      'multiThreadedConversation',
      'multiModelIntegration',
      'multiModalProcessing',
      'aiPoweredSkillSystem',
      'knowledgeBaseEngine',
      'intelligentContentCapture',
      'aiEnhancedEditor',
    ],
    [],
  );

  return (
    <Layout.Sider
      width={source === 'sider' ? (collapse ? 0 : 220) : 220}
      className={cn(
        'border border-solid border-gray-100 bg-white shadow-sm',
        source === 'sider' ? 'h-[calc(100vh)]' : 'h-[calc(100vh-100px)] rounded-r-lg',
      )}
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <SiderLogo source={source} navigate={(path) => navigate(path)} setCollapse={setCollapse} />
        <div className="flex-grow flex flex-col items-center justify-center px-3">
          <div className="text-xl font-bold">AI Native</div>
          <div className="text-xl font-bold mb-4">{t('landingPage.creationEngine')}</div>
          <div className="flex flex-col gap-2">
            {keyFeatureIds.map((featureId) => (
              <div className="text-[12px] text-gray-500" key={featureId}>
                <LuCheck className="w-4 h-4 translate-y-1 text-green-500" />{' '}
                {t(`share.keyFeatures.${featureId}`)}
              </div>
            ))}
          </div>
          <Button type="primary" className="w-full mt-4" onClick={() => setLoginModalOpen(true)}>
            {t('landingPage.tryItNow')}
          </Button>
        </div>
        <Divider className="my-2" />
        {/* Language Selector */}
        <div className="h-10 px-3 flex cursor-pointer items-center text-gray-600 hover:text-[#00968f] dark:text-gray-300 dark:hover:text-gray-100">
          <UILocaleList className="w-full">
            <Button
              type="text"
              size="middle"
              className="h-10 w-full flex-grow px-2 text-gray-600 hover:text-[#00968f] dark:text-gray-300 dark:hover:text-gray-100"
            >
              <IconLanguage className="h-4 w-4" />
              {t('language')}{' '}
              <DownOutlined className="ml-1 transition-transform duration-200 group-hover:rotate-180" />
            </Button>
          </UILocaleList>
        </div>

        {/* Social Media Links */}
        <div className="h-10 flex px-3 items-center justify-between">
          <Link
            to="https://twitter.com/reflyai"
            target="_blank"
            className="rounded-md px-2 py-1 text-gray-500 no-underline transition hover:text-gray-700"
            aria-label="Twitter"
          >
            <IconX className="flex items-center text-base" />
          </Link>
          <Link
            to="https://github.com/refly-ai"
            target="_blank"
            className="rounded-md px-2 py-1 text-gray-500 no-underline transition hover:text-gray-700"
            aria-label="GitHub"
          >
            <IconGithub className="flex items-center text-base" />
          </Link>
          <Link
            to="https://discord.gg/bWjffrb89h"
            target="_blank"
            className="rounded-md px-2 py-1 text-gray-500 no-underline transition hover:text-gray-700"
            aria-label="Discord"
          >
            <IconDiscord className="flex items-center text-base" />
          </Link>
          <Link
            to="mailto:support@refly.ai"
            target="_blank"
            className="rounded-md px-2 py-1 text-gray-500 no-underline transition hover:text-gray-700"
            aria-label="Discord"
          >
            <IconEmail className="flex items-center text-base" />
          </Link>
        </div>
      </div>
    </Layout.Sider>
  );
};
