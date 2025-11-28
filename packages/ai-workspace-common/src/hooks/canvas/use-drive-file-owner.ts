import { useEffect, useState } from 'react';
import type { DriveFile } from '@refly/openapi-schema';

export const fetchDriveFileOwnerUid = async (fileId: string): Promise<string | null> => {
  if (!fileId) {
    return null;
  }

  try {
    const response = await fetch(`/v1/drive/file/owner/${fileId}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch drive file owner: ${response.status}`);
    }
    const json = await response.json();
    return json?.data?.uid ?? null;
  } catch (error) {
    console.error('Failed to fetch drive file owner', error);
    return null;
  }
};

export const useDriveFileOwnerUid = (file?: DriveFile | null): string | null => {
  const [ownerUid, setOwnerUid] = useState<string | null>(file?.uid ?? null);

  useEffect(() => {
    let cancelled = false;

    if (!file?.fileId) {
      setOwnerUid(null);
      return () => {
        cancelled = true;
      };
    }

    if (file.uid) {
      setOwnerUid(file.uid);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const fetchedUid = await fetchDriveFileOwnerUid(file.fileId);
      if (!cancelled) {
        setOwnerUid(fetchedUid);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file?.fileId, file?.uid]);

  return ownerUid;
};
