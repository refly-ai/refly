import { memo, useState, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Logo from '../../assets/logo.svg';

interface PoweredByReflyProps {
  onClose?: () => void;
  className?: string;
}

/**
 * PoweredByRefly component displayed in shared pages when sidebar is collapsed
 * Used to provide branding and a way to expand the sidebar
 */
const PoweredByRefly = memo(({ onClose, className = '' }: PoweredByReflyProps) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const handleCloseClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm p-2 shadow-sm hover:shadow-lg z-10 cursor-pointer transition-all border border-gray-200/80 dark:border-gray-700/80 hover:bg-gray-100 dark:hover:bg-gray-700/80 ${className} border-solid`}
      style={{ borderWidth: '0.5px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img src={Logo} alt={t('productName')} className="h-6 w-6" />
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.poweredBy')}</span>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100" translate="no">
          {t('productName')}
        </span>
      </div>

      {isHovered && (
        <div
          className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-gray-200/80 dark:bg-gray-700/80 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          onClick={handleCloseClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-500 dark:text-gray-400"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      )}
    </div>
  );
});

PoweredByRefly.displayName = 'PoweredByRefly';

export default PoweredByRefly;
