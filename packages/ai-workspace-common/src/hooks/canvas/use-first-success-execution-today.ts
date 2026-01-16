import { useEffect } from 'react';
import { useListWorkflowExecutions } from '@refly-packages/ai-workspace-common/queries/queries';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';

/**
 * Hook to check if there is at least one successful workflow execution today
 * and update the canvas resources panel store.
 */
export const useFirstSuccessExecutionToday = () => {
  const { setHasFirstSuccessExecutionToday } = useCanvasResourcesPanelStoreShallow((state) => ({
    setHasFirstSuccessExecutionToday: state.setHasFirstExecutionToday,
  }));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data: listWorkflowExecutionsData } = useListWorkflowExecutions({
    query: {
      after: startOfToday.getTime(),
      order: 'creationAsc',
      pageSize: 1,
    },
  });

  const firstSuccessExecutionToday = listWorkflowExecutionsData?.data?.[0];

  useEffect(() => {
    setHasFirstSuccessExecutionToday(!!firstSuccessExecutionToday?.executionId);
  }, [firstSuccessExecutionToday, setHasFirstSuccessExecutionToday]);

  return { firstSuccessExecutionToday };
};
