import { memo } from 'react';
import WorkflowList from '@refly-packages/ai-workspace-common/components/workflow-list';

export const WorkflowListPage = memo(() => {
  return <WorkflowList />;
});

WorkflowListPage.displayName = 'WorkflowListPage';

export default WorkflowListPage;
