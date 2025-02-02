// 静态资源
import Logo from '@/assets/logo.svg';
import CloseGraySVG from '@/assets/side/close.svg';
import SettingGraySVG from '@/assets/side/setting.svg';
import FullScreenSVG from '@/assets/side/full-screen.svg';

// 组件
import { IconTip } from '@/components/icon-tip';
import { Avatar } from '@arco-design/web-react';
// stores
import { useCopilotStore } from '@refly-packages/ai-workspace-common/stores/copilot';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { getClientOrigin } from '@refly/utils/url';
import { useUserStore } from '@/stores/user';
import { useHomeStateStore } from '@/stores/home-state';
import { useTranslation } from 'react-i18next';
import { useSelectedMark } from '@/components/content-selector/hooks/use-selected-mark';
import { getRuntime } from '@refly/utils/env';

export const ChatHeader = (props: { onlyShowClose?: boolean }) => {
  const { onlyShowClose = false } = props;
  const copilotStore = useCopilotStore();
  const navigate = useNavigate();
  const { userProfile } = useUserStore();
  const homeStateStore = useHomeStateStore();
  const { handleReset } = useSelectedMark();
  const runtime = getRuntime();

  const { t } = useTranslation();

  const showBtn = !!userProfile?.uid;

  return (
    <header style={{ padding: `0 12px` }}>
      <div
        className="brand"
        onClick={() => {
          window.open(`${getClientOrigin()}/`, '_blank');
          homeStateStore.setActiveTab('home');
        }}
      >
        <div className="flex items-center cursor-pointer">
          <img src={Logo} alt="Refly" className="w-6 h-6" />
          <span className="text-xs font-bold ml-2">Refly</span>
        </div>
      </div>
      <div className="flex items-center">
        <IconTip text={t('extension.loggedHomePage.homePage.header.fullscreen')}>
          <img
            src={FullScreenSVG}
            alt={t('extension.loggedHomePage.homePage.header.fullscreen')}
            style={{ marginRight: 12 }}
            className="w-4 h-4 cursor-pointer"
            onClick={() => window.open(`${getClientOrigin()}/`, '_blank')}
          />
        </IconTip>
        {/* <IconTip text="通知">
                <img src={NotificationSVG} alt="通知" />
            </IconTip> */}
        {showBtn && !onlyShowClose && (
          <IconTip text={t('extension.loggedHomePage.homePage.header.settings')}>
            <img
              src={SettingGraySVG}
              alt={t('extension.loggedHomePage.homePage.header.settings')}
              style={{ marginRight: 12 }}
              className="w-4 h-4 cursor-pointer"
              onClick={() => window.open(`${getClientOrigin()}/settings`, '_blank')}
            />
          </IconTip>
        )}
        {showBtn && !onlyShowClose && (
          <IconTip text={t('extension.loggedHomePage.homePage.header.account')}>
            <Avatar size={16} style={{ marginRight: 12 }}>
              <img
                alt="avatar"
                src={userProfile?.avatar}
                className="w-4 h-4 cursor-pointer"
                onClick={() => window.open(`${getClientOrigin()}/settings`, '_blank')}
              />
            </Avatar>
          </IconTip>
        )}
        <IconTip text={t('extension.loggedHomePage.homePage.header.close')}>
          <img
            src={CloseGraySVG}
            alt={t('extension.loggedHomePage.homePage.header.close')}
            className="w-4 h-4 cursor-pointer"
            onClick={(_) => {
              if (runtime === 'extension-sidepanel') {
                handleReset();
                window.close();
              } else if (runtime === 'extension-csui') {
                copilotStore.setIsCopilotOpen(false);
              }
            }}
          />
        </IconTip>
      </div>
    </header>
  );
};
