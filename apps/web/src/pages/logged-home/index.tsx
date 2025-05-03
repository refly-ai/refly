import React from 'react';
import { Dashboard } from '@refly-packages/ai-workspace-common/components/dashboard';
import { useTranslation } from 'react-i18next';

const LoggedHome = React.memo(() => {
  const { t } = useTranslation();

  return (
    <Dashboard
      title={t('home.welcome', 'Welcome to Refly')}
      showTemplates={true}
      showRecentCanvases={true}
    />
  );
});

LoggedHome.displayName = 'LoggedHome';

export default LoggedHome;
