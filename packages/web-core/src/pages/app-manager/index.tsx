import { memo, useEffect } from 'react';

import { AppManager } from '@refly-packages/ai-workspace-common/components/app-manager';
import { logEvent } from '@refly/telemetry-web';
const AppManagerPage = memo(() => {
  useEffect(() => {
    logEvent('enter_workflow_list');
  }, []);

  return <AppManager />;
});

AppManagerPage.displayName = 'AppManagerPage';

export default AppManagerPage;
