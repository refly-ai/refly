import { useState } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useDebouncedCallback } from 'use-debounce';
import { useSubscriptionUsage } from '../use-subscription-usage';

export const useDeleteResource = () => {
  const [isRemoving, setIsRemoving] = useState(false);

  const { refetchUsage } = useSubscriptionUsage();

  const deleteResource = async (resourceId: string) => {
    if (isRemoving) return;
    let success = false;
    try {
      setIsRemoving(true);
      const { data } = await getClient().deleteResource({
        body: { resourceId },
      });

      if (data?.success) {
        success = true;
      }
    } finally {
      setIsRemoving(false);
      refetchUsage();
    }
    return success;
  };

  const debouncedDeleteResource = useDebouncedCallback(
    (resourceId: string) => {
      return deleteResource(resourceId);
    },
    300,
    { leading: true },
  );

  return { deleteResource: debouncedDeleteResource, isRemoving };
};
