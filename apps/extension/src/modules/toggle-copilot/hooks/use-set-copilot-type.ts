import { storage } from '@refly-packages/ai-workspace-common/utils/storage';
import { getRuntime } from '@refly/utils/env';
import { useEffect } from 'react';
import {
  useCopilotTypeStore,
  copilotTypeEnums,
} from '@/modules/toggle-copilot/stores/use-copilot-type';
import { ICopilotType } from '@refly/common-types';

/**
 * core logic:
 *
 * 1. useSetCopilotType for init copilotType
 * 2. useListenToCopilotType for listen to copilotType change
 * 3. judge copilotType for only handle checkArcBrowser once
 */
export const useSetCopilotType = () => {
  const copilotTypeStore = useCopilotTypeStore((state) => ({
    setCopilotType: state.setCopilotType,
  }));
  const runtime = getRuntime();

  const setCopilotTypeStorage = async () => {
    const { copilotType } = useCopilotTypeStore.getState();
    console.log('copilotType', copilotType);
    if (copilotType && copilotTypeEnums.includes(copilotType)) {
      return;
    }

    const copilotTypeStorage = await storage.getItem('sync:copilotType');
    console.log('copilotTypeStorage', copilotTypeStorage);
    if (copilotTypeStorage && copilotTypeEnums.includes(copilotTypeStorage as ICopilotType)) {
      return;
    }

    copilotTypeStore.setCopilotType(runtime as ICopilotType);
    await storage.setItem('sync:copilotType', runtime);
  };

  useEffect(() => {
    setCopilotTypeStorage();
  }, []);
};
