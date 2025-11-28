import React, { createContext, useContext } from 'react';

type PublicFileUrlContextValue = boolean | undefined;

const PublicFileUrlContext = createContext<PublicFileUrlContextValue>(undefined);

export const PublicFileUrlProvider = ({
  value,
  children,
}: {
  value?: boolean;
  children: React.ReactNode;
}) => {
  return <PublicFileUrlContext.Provider value={value}>{children}</PublicFileUrlContext.Provider>;
};

export const usePublicFileUrlContext = (): PublicFileUrlContextValue => {
  return useContext(PublicFileUrlContext);
};
