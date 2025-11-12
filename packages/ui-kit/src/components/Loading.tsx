import Logo from '../../assets/logo.svg';
import { LoadingOutlined } from '@ant-design/icons';

export const LightLoading = () => {
  return (
    <div className="w-screen flex flex-col justify-center items-center h-[var(--screen-height)]">
      <div className="flex justify-center items-center mb-5">
        <img src={Logo} alt="Refly" className="w-12 h-12 mr-3" />
        <span className="text-3xl font-bold">Refly </span>
      </div>
      <div className="text-gray-600 dark:text-gray-300">
        <LoadingOutlined className="mr-2" />
        <span>Loading...</span>
      </div>
    </div>
  );
};
