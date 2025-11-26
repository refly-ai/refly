import { useMemo, useEffect, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { serverOrigin } from '@refly/ui-kit';
import type { DriveFile } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

interface UseFileUrlOptions {
  file?: DriveFile | null;
  download?: boolean;
}

interface UseFileUrlResult {
  fileUrl: string | null;
  isLoading?: boolean;
}

/**
 * Get file URL based on context (async function with auto publicURL fetching)
 * - In share pages: automatically fetches publicURL if not available, then uses it
 * - In other pages: use API endpoint /v1/drive/file/content/:fileId
 */
export const getDriveFileUrlAsync = async (
  file: DriveFile | null | undefined,
  isSharePage: boolean,
  download = false,
): Promise<UseFileUrlResult> => {
  if (!file?.fileId) {
    return {
      fileUrl: null,
    };
  }

  let enrichedFile = file;

  // If in share page and file doesn't have publicURL, fetch it
  if (isSharePage && !file.publicURL) {
    try {
      const { data, error } = await getClient().getFilePublicUrl({
        path: { fileId: file.fileId },
      });

      if (!error && data?.success && data.data?.publicUrl) {
        enrichedFile = {
          ...file,
          publicURL: data.data.publicUrl,
        };
      }
    } catch (err) {
      console.warn('Failed to fetch publicURL:', err);
      // Continue with original file
    }
  }

  // In share pages, prefer publicURL if available
  if (isSharePage && enrichedFile.publicURL) {
    return {
      fileUrl: enrichedFile.publicURL,
    };
  }

  // Fallback to API endpoint
  const url = new URL(`${serverOrigin}/v1/drive/file/content/${enrichedFile.fileId}`);
  if (download) {
    url.searchParams.set('download', '1');
  }
  return {
    fileUrl: url.toString(),
  };
};

/**
 * Hook to get the correct file URL based on context
 * - In share pages: automatically fetches publicURL if not available, then uses it
 * - In other pages: use API endpoint /v1/drive/file/content/:fileId
 */
export const useDriveFileUrl = ({
  file,
  download = false,
}: UseFileUrlOptions): UseFileUrlResult => {
  // Check if current page is any share page
  const isShareCanvas = useMatch('/share/canvas/:canvasId');
  const isShareFile = useMatch('/share/file/:shareId');
  const isSharePage = Boolean(isShareCanvas || isShareFile);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!file?.fileId) {
      setFileUrl(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    // Use getFileUrlAsync to handle publicURL fetching automatically
    getDriveFileUrlAsync(file, isSharePage, download)
      .then((result) => {
        if (!isCancelled) {
          setFileUrl(result.fileUrl);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to get file URL:', err);
          setFileUrl(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [file?.fileId, file?.publicURL, isSharePage, download]);

  return useMemo(
    () => ({
      fileUrl,
      isLoading,
    }),
    [fileUrl, isLoading],
  );
};
