import { useEffect, useRef } from 'react';

import './App.scss';

// hooks
// 设置 runtime 环境
import { setRuntime } from '@refly/utils/env';
import { useSyncWeblinkResourceMeta } from '@/hooks/content-scripts/use-get-weblink-resource-meta';
import { checkPageUnsupported } from '@refly-packages/ai-workspace-common/utils/extension/check';

const App = () => {
  // 在挂载时记录当前资源,Only for Content Script
  const { initMessageListener } = useSyncWeblinkResourceMeta();
  const isDomVisibilityRef = useRef<'visible' | 'hidden'>(document.visibilityState);

  const handleVisibilityChange = () => {
    isDomVisibilityRef.current = document.visibilityState;
  };

  useEffect(() => {
    // Initial check if the page is already visible
    if (isDomVisibilityRef.current === 'visible' && !checkPageUnsupported(location.href)) {
      // checkBrowserArc();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  useEffect(() => {
    setRuntime('extension-csui');
    initMessageListener();
  }, []);

  return <></>;
};

export default App;
