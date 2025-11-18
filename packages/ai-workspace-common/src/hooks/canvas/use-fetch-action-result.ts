import { useCallback, useState } from 'react';
import { Node } from '@xyflow/react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { processContentPreview } from '@refly-packages/ai-workspace-common/utils/content';
import { useActionResultStoreShallow, useUserStore } from '@refly/stores';
import { useNodeData } from './use-node-data';

export const useFetchActionResult = () => {
  const { setNodeData } = useNodeData();
  const { updateActionResult } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
  }));

  const [loading, setLoading] = useState(false);

  const fetchActionResult = useCallback(
    async (resultId: string, options?: { nodeToUpdate?: Node; silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const { isLogin } = useUserStore.getState();
      if (!isLogin) {
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      const { data, error } = await getClient().getActionResult({
        query: { resultId },
      });
      if (!silent) {
        setLoading(false);
      }

      if (error || !data?.success) {
        return;
      }

      updateActionResult(resultId, data.data!);

      const remoteResult = data.data;
      const node = options?.nodeToUpdate;

      if (node?.id && remoteResult) {
        setNodeData(node.id, {
          contentPreview: processContentPreview(remoteResult.steps?.map((s) => s?.content || '')),
          metadata: {
            status: remoteResult?.status,
            reasoningContent: processContentPreview(
              remoteResult.steps?.map((s) => s?.reasoningContent || ''),
            ),
          },
        });
      }
    },
    [setNodeData, updateActionResult],
  );

  return {
    fetchActionResult,
    loading,
  };
};
