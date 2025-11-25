import { useMemo } from 'react';
import { useMatch } from 'react-router-dom';
import { serverOrigin } from '@refly/ui-kit';
import type { DriveFile } from '@refly/openapi-schema';

interface UseFileUrlOptions {
  file?: DriveFile | null;
  download?: boolean;
}

interface UseFileUrlResult {
  fileUrl: string | null;
  shouldFetch: boolean;
  isSharePage: boolean;
}

/**
 * Get file URL based on context (pure function)
 * - In share pages: use publicURL if available
 * - In other pages: use API endpoint /v1/drive/file/content/:fileId
 */
export const getFileUrl = (
  file: DriveFile | null | undefined,
  isSharePage: boolean,
  download = false,
): UseFileUrlResult => {
  if (!file?.fileId) {
    return {
      fileUrl: null,
      shouldFetch: false,
      isSharePage,
    };
  }

  // In share pages, prefer publicURL if available
  if (isSharePage && file.publicURL) {
    const url = new URL(file.publicURL);
    if (download) {
      url.searchParams.set('download', '1');
    }
    return {
      fileUrl: url.toString(),
      shouldFetch: false, // Direct URL, no need to fetch with credentials
      isSharePage,
    };
  }

  // Fallback to API endpoint
  const url = new URL(`${serverOrigin}/v1/drive/file/content/${file.fileId}`);
  if (download) {
    url.searchParams.set('download', '1');
  }
  return {
    fileUrl: url.toString(),
    shouldFetch: true, // API endpoint, needs credentials
    isSharePage,
  };
};

/**
 * Hook to get the correct file URL based on context
 * - In share pages: use publicURL if available
 * - In other pages: use API endpoint /v1/drive/file/content/:fileId
 */
export const useFileUrl = ({ file, download = false }: UseFileUrlOptions): UseFileUrlResult => {
  const isShareCanvas = useMatch('/share/*/:canvasId');
  const isSharePage = Boolean(isShareCanvas);

  const result = useMemo<UseFileUrlResult>(
    () => getFileUrl(file, isSharePage, download),
    [file?.fileId, file?.publicURL, isSharePage, download],
  );

  return result;
};
