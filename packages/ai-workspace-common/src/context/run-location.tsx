import { createContext, useContext } from 'react';
import type { DriveFile } from '@refly/openapi-schema';

export type LastRunTabLocation = 'agent' | 'runlog';

export interface SetCurrentFileOptions {
  usePublicFileUrl?: boolean;
}

export interface LastRunTabContextValue {
  location: LastRunTabLocation;
  setCurrentFile?: (file: DriveFile | null, options?: SetCurrentFileOptions) => void;
}

export const LastRunTabContext = createContext<LastRunTabContextValue | null>(null);

export const useLastRunTabContext = (): LastRunTabContextValue => {
  const context = useContext(LastRunTabContext);
  return context ?? { location: 'agent' };
};
