import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import { logEvent } from '@refly/telemetry-web';
import {
  usePendingVoucherClaim,
  storePendingVoucherCode,
} from '@refly-packages/ai-workspace-common/hooks/use-pending-voucher-claim';
import { usePrefetchWorkflow } from '../../hooks/use-prefetch-workflow';

const WorkspacePage = () => {
  const [searchParams] = useSearchParams();

  // Check for invite parameter in URL and store it
  useEffect(() => {
    const inviteCode = searchParams.get('invite');
    if (inviteCode) {
      storePendingVoucherCode(inviteCode);
    }
  }, [searchParams]);

  // Handle claiming voucher that was pending when user was not logged in
  usePendingVoucherClaim();

  // 预加载 workflow 页面资源（在浏览器空闲时）
  // 用户可能会点击某个 workflow，提前加载可以让切换更流畅
  usePrefetchWorkflow();

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
