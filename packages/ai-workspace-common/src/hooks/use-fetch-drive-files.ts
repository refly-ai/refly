import { useUserStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListDriveFiles } from '@refly-packages/ai-workspace-common/queries/queries';
import { useGetProjectCanvasId } from './use-get-project-canvasId';
import { ListDriveFilesData } from '@refly/openapi-schema';

// later optimize to support page scroll
const DEFAULT_PAGE_SIZE = 100;

export const useFetchDriveFiles = (params?: Partial<ListDriveFilesData['query']>) => {
  // Safely read canvas context; fall back to defaults when not within a provider
  let canvasId: string | undefined;
  let shareData: any;
  let shareLoading = false;
  try {
    const ctx = useCanvasContext();
    canvasId = ctx.canvasId;
    shareData = ctx.shareData;
    shareLoading = ctx.shareLoading;
  } catch {
    canvasId = undefined;
    shareData = null;
    shareLoading = false;
  }
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
