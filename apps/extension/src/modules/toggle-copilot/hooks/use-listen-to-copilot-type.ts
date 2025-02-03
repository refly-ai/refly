import { useEffect } from 'react';
import { useCopilotTypeStore, copilotTypeEnums } from '../stores/use-copilot-type';
import { useStorage } from '@/hooks/use-storage';
import { ICopilotType } from '@refly/common-types';

// use in
export const useListenToCopilotType = () => {
  const copilotTypeStore = useCopilotTypeStore((state) => ({
    setCopilotType: state.setCopilotType,
    copilotType: state.copilotType,
  }));

  // 监听更改
  const [copilotTypeStorage, _setCopilotTypeStorage] = useStorage('copilotType', '', 'sync');

  // 监听copilotTypeStorage的变化
  useEffect(() => {
    console.log('useListenToCopilotType copilotTypeStorage', copilotTypeStorage, copilotTypeStore);
    if (
      !copilotTypeStore?.copilotType &&
      copilotTypeStorage &&
      copilotTypeEnums.includes(copilotTypeStorage as ICopilotType)
    ) {
      copilotTypeStore.setCopilotType(copilotTypeStorage as ICopilotType);
    }
  }, [copilotTypeStorage]);
};
