import { useEffect } from 'react';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import { logEvent } from '@refly/telemetry-web';

const WorkspacePage = () => {
  useEffect(() => {
    logEvent('enter_workspace');
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <FrontPage />
    </div>
  );
};

export default WorkspacePage;
