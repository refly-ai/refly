import { useEffect } from 'react';
import { useState } from 'react';
import { SuspenseLoading } from '@refly-packages/ai-workspace-common/components/common/loading';
import { ReactNode } from 'react';

export const HomeRedirect = ({ defaultNode }: { defaultNode: ReactNode }) => {
  const [element, setElement] = useState<ReactNode | null>(null);

  useEffect(() => {
    // Just show the defaultNode, which now handles the login state internally
    setElement(defaultNode);
  }, [defaultNode]);

  return element ?? <SuspenseLoading />;
};
