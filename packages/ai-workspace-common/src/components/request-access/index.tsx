import { Result, Button, Modal, Typography } from 'antd';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useTranslation } from 'react-i18next';
import { useLogout } from '@refly-packages/ai-workspace-common/hooks/use-logout';

import './index.scss';

const RequestAccess = () => {
  const userStore = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));
  const { t } = useTranslation();
  const { handleLogout, contextHolder } = useLogout();

  const _visible = true;

  return (
    <Modal
      className="request-access-modal"
      open={true}
      closable={false}
      footer={null}
      styles={{ mask: { background: '#FFFFFF' } }}
    >
      <div className="flex justify-center items-center h-full request-access">
        <Result
          status="403"
          title={
            <div>
              <div className="mb-2" style={{ fontSize: '18px' }}>
                {t('requestAccess.description')}
              </div>
              <div style={{ color: 'rgba(0, 0, 0, 0.5)' }}>
                {t('requestAccess.copyEmail')}
                <Typography.Text
                  copyable={{
                    tooltips: [t('common.copy.title'), t('common.copy.success')],
                  }}
                >
                  {userStore?.userProfile?.email}
                </Typography.Text>
              </div>
            </div>
          }
          extra={
            <>
              <Button
                type="primary"
                onClick={() => {
                  window.open(
                    'https://powerformer.feishu.cn/share/base/form/shrcnaVXPlMWxOC6cJDa7q3cPzd',
                    '_blank',
                  );
                }}
              >
                {t('requestAccess.apply')}
              </Button>
              <Button className="ml-4" onClick={handleLogout}>
                {t('loggedHomePage.siderMenu.logout')}
              </Button>
            </>
          }
        />
      </div>
      {contextHolder}
    </Modal>
  );
};

export default RequestAccess;
