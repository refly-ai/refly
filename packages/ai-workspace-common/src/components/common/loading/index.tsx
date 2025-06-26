import { useTranslation } from 'react-i18next';
import Logo from '@/assets/logo.svg';
import { LoadingOutlined } from '@ant-design/icons';

export const SuspenseLoading = () => {
  const { t } = useTranslation();

  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center">
      <div className="flex justify-center items-center mb-5">
        <img src={Logo} alt="Refly" className="w-12 h-12 mr-3" />
        <span className="text-3xl font-bold">Refly </span>
      </div>
      <div className="text-gray-600 dark:text-gray-300">
        <LoadingOutlined className="mr-2" />
        <span>{t('common.appStarting')}</span>
      </div>
    </div>
  );
};

export const LightLoading = () => {
  const { t } = useTranslation();
  return (
    <div className="h-screen w-screen flex justify-center items-center">
      <LoadingOutlined className="mr-2" />
      <span>{t('common.loading')}</span>
    </div>
  );
};
