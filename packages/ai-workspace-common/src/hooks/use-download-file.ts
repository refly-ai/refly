import { serverOrigin } from '@refly-packages/ai-workspace-common/utils/env';

export const useDownloadFile = () => {
  const downloadFile = (rawFileKey: string) => {
    const fileUrl = `${serverOrigin}/v1/misc/${rawFileKey}`;
    window.open(fileUrl, '_blank');
  };
  return { downloadFile };
};
