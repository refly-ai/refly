import { useTranslation } from 'react-i18next';
import { MenuProps, Dropdown } from 'antd';
import { LuSettings, LuLogOut } from 'react-icons/lu';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useLogout } from '@refly-packages/ai-workspace-common/hooks/use-logout';
import { GrGroup } from 'react-icons/gr';
import { MemoizedIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import { IconChrome } from '@refly-packages/ai-workspace-common/components/common/icon';
import { EXTENSION_DOWNLOAD_LINK } from '@refly/utils/url';
export const SiderMenuSettingList = (props: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const { setShowSettingModal } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
  }));
  const { handleLogout, contextHolder } = useLogout();

  const items: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <div className="px-4 py-1 cursor-text">
          <div className="text-sm font-semibold text-black">{userStore?.userProfile?.nickname}</div>
          <div className="text-xs text-gray-500 max-w-36 truncate">
            {userStore?.userProfile?.email ?? 'No email provided'}
          </div>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'settings',
      icon: <LuSettings size={14} />,
      label: t('loggedHomePage.siderMenu.settings'),
    },
    {
      key: 'contactUs',
      icon: <GrGroup size={14} />,
      label: t('loggedHomePage.siderMenu.contactUs'),
    },
    {
      key: 'addToChrome',
      icon: <MemoizedIcon icon={IconChrome} className="w-[14px] h-[14px]" />,
      label: t('loggedHomePage.siderMenu.addToChrome'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LuLogOut size={14} />,
      label: t('loggedHomePage.siderMenu.logout'),
    },
  ];

  const handleMenuClick = (key: string) => {
    if (key === 'contactUs') {
      window.open('https://docs.refly.ai/community/contact-us', '_blank');
    } else if (key === 'settings') {
      setShowSettingModal(true);
    } else if (key === 'logout') {
      handleLogout();
    } else if (key === 'addToChrome') {
      window.open(EXTENSION_DOWNLOAD_LINK, '_blank');
    }
  };

  return (
    <div>
      <Dropdown
        trigger={['click']}
        arrow={false}
        placement="bottom"
        menu={{
          items,
          onClick: ({ key }) => handleMenuClick(key),
          className: '[&_.ant-dropdown-menu-item-disabled]:!p-0',
        }}
      >
        {props.children}
      </Dropdown>
      {contextHolder}
    </div>
  );
};
