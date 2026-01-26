import { memo, useEffect } from 'react';
import WorkflowList from '@refly-packages/ai-workspace-common/components/workflow-list';
import { logEvent } from '@refly/telemetry-web';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

const WorkflowListPage = memo(() => {
  const { t } = useTranslation();
  useEffect(() => {
    logEvent('enter_publish_page');
  }, []);

  return (
    <>
      <Helmet>
        <title>{t('loggedHomePage.siderMenu.canvas')}</title>
      </Helmet>
      <WorkflowList />
    </>
  );
});

WorkflowListPage.displayName = 'WorkflowListPage';

export default WorkflowListPage;
