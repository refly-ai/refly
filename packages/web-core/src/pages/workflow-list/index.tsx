import { memo, useEffect } from 'react';
import WorkflowList from '@refly-packages/ai-workspace-common/components/workflow-list';
import { logEvent } from '@refly/telemetry-web';

export const WorkflowListPage = memo(() => {
  useEffect(() => {
    logEvent('enter_publish_page');
  }, []);

  return <WorkflowList />;
});

WorkflowListPage.displayName = 'WorkflowListPage';

export default WorkflowListPage;
