import { createContext, useContext } from 'react';

export type LastRunTabLocation = 'agent' | 'runlog';

export interface LastRunTabContextValue {
  location: LastRunTabLocation;
}

export const LastRunTabContext = createContext<LastRunTabContextValue | null>(null);

export const useLastRunTabContext = () => {
  const context = useContext(LastRunTabContext);
  return context ?? { location: 'agent' };
};
