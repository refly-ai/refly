import { LoadingOutlined } from '@ant-design/icons';
import { Logo } from '../../../ai-workspace-common/src/components/common/logo';

export const LightLoading = () => {
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
