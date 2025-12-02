import { useMemo } from 'react';
import { usePublicFileUrlContext } from '@refly-packages/ai-workspace-common/context/public-file-url';
import { useMatch } from 'react-router-dom';
import { serverOrigin } from '@refly/ui-kit';
import type { DriveFile } from '@refly/openapi-schema';

interface UseFileUrlOptions {
  file?: DriveFile | null;
  download?: boolean;
}

interface UseFileUrlResult {
  fileUrl: string | null;
  isLoading?: boolean;
}

/**
 * Get file URL based on context
 */
export const getDriveFileUrl = (
  file: DriveFile | null | undefined,
  isSharePage: boolean,
  usePublicFileUrl?: boolean,
  download = false,
): UseFileUrlResult => {
  if (!file?.fileId) {
    return {
      fileUrl: null,
    };
  }

  if (usePublicFileUrl !== undefined) {
    return {
      fileUrl: usePublicFileUrl
        ? `${serverOrigin}/v1/drive/file/public/${file.fileId}`
        : `${serverOrigin}/v1/drive/file/content/${file.fileId}${download ? '?download=1' : ''}`,
    };
  }

  if (isSharePage) {
    return {
      fileUrl: `${serverOrigin}/v1/drive/file/public/${file.fileId}`,
    };
  }

  // Fallback to API endpoint
  try {
    const url = new URL(`${serverOrigin}/v1/drive/file/content/${file.fileId}`);
    if (download) {
      url.searchParams.set('download', '1');
    }
    return {
      fileUrl: url.toString(),
    };
  } catch (error) {
    console.error('Error getting drive file URL:', error);
    return {
      fileUrl: null,
    };
  }
};

/**
 * Hook to get the correct file URL based on context
 */
export const useDriveFileUrl = ({
  file,
  download = false,
}: UseFileUrlOptions): UseFileUrlResult => {
  const contextUsePublicFileUrl = usePublicFileUrlContext();
  // Check if current page is any share page
  const isShareCanvas = useMatch('/share/canvas/:canvasId');
  const isShareFile = useMatch('/share/file/:shareId');
  // Add workflow-app page check
  const isWorkflowApp = useMatch('/app/:shareId');
  const isTemplateApp = useMatch('/workflow-template/:shareId');
  const isSharePage = Boolean(isShareCanvas || isShareFile || isWorkflowApp || isTemplateApp);

  return useMemo(() => {
    return getDriveFileUrl(file, isSharePage, contextUsePublicFileUrl, download);
  }, [file?.fileId, isSharePage, download, contextUsePublicFileUrl]);
};
