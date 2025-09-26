import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { Button, Empty } from 'antd';
import { ArrowLeft, Project } from 'refly-icons';

const AppManagerPage = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <Button
            type="text"
            icon={<ArrowLeft size={20} />}
            onClick={() => navigate('/')}
            className="text-gray-600 dark:text-gray-400"
          />
          <div className="flex items-center gap-2">
            <Project size={24} className="text-gray-600 dark:text-gray-400" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {t('loggedHomePage.siderMenu.appManager')}
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="h-full flex items-center justify-center">
          <Empty description={t('common.comingSoon')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </div>
    </div>
  );
});

AppManagerPage.displayName = 'AppManagerPage';

export default AppManagerPage;
