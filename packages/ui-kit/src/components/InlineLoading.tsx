import { LoadingOutlined } from '@ant-design/icons';
import { Logo } from '../../../ai-workspace-common/src/components/common/logo';

/**
 * InlineLoading - Lightweight loading component for route transitions
 * Unlike LightLoading, this does NOT trigger the full-screen HTML loader
 * Use this for in-page loading states where you want to keep the layout visible
 */
export const InlineLoading = () => {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center">
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
