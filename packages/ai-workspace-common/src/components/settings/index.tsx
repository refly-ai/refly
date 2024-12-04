import { Tabs, Modal } from 'antd';
import { useEffect } from 'react';

// components
import { useTranslation } from 'react-i18next';

import { AccountSetting } from '@refly-packages/ai-workspace-common/components/settings/account-setting';
import { LanguageSetting } from '@refly-packages/ai-workspace-common/components/settings/language-setting';
import { Subscription } from '@refly-packages/ai-workspace-common/components/settings/subscription';

import { RiAccountBoxLine } from 'react-icons/ri';
import { HiOutlineLanguage } from 'react-icons/hi2';
import { MdOutlineSubscriptions } from 'react-icons/md';

import './index.scss';
import { IconSettings } from '@refly-packages/ai-workspace-common/components/common/icon';

const iconStyle = { fontSize: 16, transform: 'translateY(3px)' };

interface SettingModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}
export const SettingModal = (props: SettingModalProps) => {
  const { visible, setVisible } = props;
  const { t, i18n } = useTranslation();

  const tabs = [
    {
      key: 'subscription',
      label: t('settings.tabs.subscription'),
      icon: <MdOutlineSubscriptions style={iconStyle} />,
      children: <Subscription />,
    },
    {
      key: 'account',
      label: t('settings.tabs.account'),
      icon: <RiAccountBoxLine style={iconStyle} />,
      children: <AccountSetting />,
    },
    {
      key: 'language',
      label: t('settings.tabs.language'),
      icon: <HiOutlineLanguage style={iconStyle} />,
      children: <LanguageSetting />,
    },
  ];
  useEffect(() => {
    console.log('useEffect', i18n.language);
  }, [i18n.language]);

  return (
    <Modal
      className="settings-modal"
      centered
      title={
        <span className="flex items-center gap-2 text-lg font-medium ml-5">
          <IconSettings /> {t('tabMeta.settings.title')}
        </span>
      }
      width={i18n.language === 'zh-CN' ? 850 : 910}
      footer={null}
      open={visible}
      onCancel={() => setVisible(false)}
    >
      <Tabs size="small" className="pt-2" tabPosition="left" items={tabs} />
    </Modal>
  );
};
