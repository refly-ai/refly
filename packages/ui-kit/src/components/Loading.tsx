import { useEffect } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { Logo } from '../../../ai-workspace-common/src/components/common/logo';

export const LightLoading = () => {
  useEffect(() => {
    (window as any).__REFLY_SHOW_LOADING__?.();
    return () => (window as any).__REFLY_HIDE_LOADING__?.();
  }, []);

  // If the global loader is available in HTML, we don't need to render anything in React
  // because the HTML loader is fixed full-screen with z-index 9999.
  if (typeof window !== 'undefined' && (window as any).__REFLY_SHOW_LOADING__) {
    return null;
  }

  return (
    <div className="w-screen flex flex-col justify-center items-center h-[var(--screen-height)]">
      <div className="flex justify-center items-center mb-5">
        <Logo
          logoProps={{ show: true, className: '!w-10' }}
          textProps={{ show: true, className: '!w-[90px] translate-y-[2px]' }}
        />
      </div>
      <div className="text-gray-600 dark:text-gray-300">
        <LoadingOutlined className="mr-2" />
        <span>Loading...</span>
      </div>
    </div>
  );
};
