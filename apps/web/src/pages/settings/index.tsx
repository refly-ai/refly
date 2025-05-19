import { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { Helmet } from 'react-helmet';

// styles
import './index.scss';
// components
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';

import { AccountSetting } from '@refly-packages/ai-workspace-common/components/settings/account-setting';
import { LanguageSetting } from '@refly-packages/ai-workspace-common/components/settings/language-setting';
import { Subscription } from '@refly-packages/ai-workspace-common/components/settings/subscription';

import { RiAccountBoxLine } from 'react-icons/ri';
import { HiOutlineLanguage } from 'react-icons/hi2';
import { MdOutlineSubscriptions } from 'react-icons/md';

import PageTitle from '@/pages/page-title';

const { TabPane } = Tabs;
const iconStyle = { fontSize: 16, marginRight: 8 };

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>('account');

  const handleTabChange = (key: string) => {
    setTab(key);
    navigate(`?tab=${key}`);
  };

  useEffect(() => {
    const tab = searchParams.get('tab') as string;
    setTab(tab || 'account');
  }, [searchParams]);

  return (
    <div className="settings-container">
      <Helmet>
        <title>
          {t('productName')} | {t('tabMeta.settings.title')}
        </title>
      </Helmet>
      <PageTitle title={t('settings.title')} />
      <div className="settings-inner-container pt-4">
        <Tabs activeKey={tab} tabPosition="left" size="large" onChange={handleTabChange}>
          <TabPane
            key="account"
            className="settings-tab"
            tab={
              <span className="settings-tab-title">
                <RiAccountBoxLine style={iconStyle} />
                {t('settings.tabs.account')}
              </span>
            }
          >
            <AccountSetting />
          </TabPane>

          <TabPane
            key="subscription"
            className="settings-tab"
            tab={
              <span className="settings-tab-title">
                <MdOutlineSubscriptions style={iconStyle} />
                {t('settings.tabs.subscription')}
              </span>
            }
          >
            <Subscription />
          </TabPane>

          <TabPane
            key="language"
            className="settings-tab"
            tab={
              <span className="settings-tab-title">
                <HiOutlineLanguage style={iconStyle} />
                {t('settings.tabs.language')}
              </span>
            }
          >
            <LanguageSetting />
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
