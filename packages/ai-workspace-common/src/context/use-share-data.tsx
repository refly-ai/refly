import React, { createContext, useContext } from 'react';

/**
 * Context to control whether components should use shareData or fetch from API.
 *
 * - `true`: Use shareData (for workflow app result preview, shared content viewing)
 * - `false`: Fetch from API (for workflow execution products, canvas editing)
 * - `undefined`: Default behavior based on component logic
 */
type UseShareDataContextValue = boolean | undefined;

const UseShareDataContext = createContext<UseShareDataContextValue>(undefined);

export const UseShareDataProvider = ({
  value,
  children,
}: {
  value?: boolean;
  children: React.ReactNode;
}) => {
  return <UseShareDataContext.Provider value={value}>{children}</UseShareDataContext.Provider>;
};

export const useShareDataContext = (): UseShareDataContextValue => {
  return useContext(UseShareDataContext);
};
