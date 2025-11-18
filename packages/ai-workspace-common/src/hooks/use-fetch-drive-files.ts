import { useUserStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListDriveFiles } from '@refly-packages/ai-workspace-common/queries/queries';
import { useGetProjectCanvasId } from './use-get-project-canvasId';
import { ListDriveFilesData } from '@refly/openapi-schema';

// later optimize to support page scroll
const DEFAULT_PAGE_SIZE = 100;

export const useFetchDriveFiles = (params?: Partial<ListDriveFilesData['query']>) => {
  const { canvasId, shareData, shareLoading } = useCanvasContext();
  const { projectId } = useGetProjectCanvasId();
  const isLogin = useUserStoreShallow((state) => state.isLogin);

  const fetchRemoteEnabled = isLogin && !shareData;
  const {
    data: filesData,
    isLoading: isLoadingFiles,
    refetch,
  } = useListDriveFiles(
    {
      query: {
        canvasId,
        projectId,
        source: 'manual',
        pageSize: DEFAULT_PAGE_SIZE,
        ...params,
      },
    },
    [],
    { enabled: fetchRemoteEnabled },
  );

  return {
    data: shareData?.files ?? filesData?.data ?? [],
    refetch: fetchRemoteEnabled ? refetch : () => {},
    isLoading: shareLoading || isLoadingFiles,
  };
};
