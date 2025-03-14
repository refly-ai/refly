import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import Logo from '@/assets/logo.svg';

interface PoweredByReflyProps {
  onClick: () => void;
  className?: string;
}

/**
 * PoweredByRefly component displayed in shared pages when sidebar is collapsed
 * Used to provide branding and a way to expand the sidebar
 */
const PoweredByRefly = memo(({ onClick, className = '' }: PoweredByReflyProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={`fixed bottom-4 left-4 flex items-center gap-2 rounded-lg bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm p-2 shadow-sm hover:shadow-lg z-10 cursor-pointer transition-all border border-gray-200/80 dark:border-gray-700/80 hover:bg-gray-100 dark:hover:bg-gray-700/80 ${className} border-solid`}
      style={{ borderWidth: '0.5px' }}
      onClick={onClick}
    >
      <img src={Logo} alt={t('productName')} className="h-6 w-6" />
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.poweredBy')}</span>
        <span className="text-sm font-bold text-gray-800 dark:text-white" translate="no">
          {t('productName')}
        </span>
      </div>
    </div>
  );
});

PoweredByRefly.displayName = 'PoweredByRefly';

export default PoweredByRefly;
