import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly/utils/cn';
import { NexuIcon } from './NexuIcon';
import { LuArrowRight } from 'react-icons/lu';
import { logEvent } from '@refly/telemetry-web';

const NEXU_URL = 'https://nexu.io';

interface NexuStickyBarProps {
  className?: string;
}

export const NexuStickyBar = memo(({ className }: NexuStickyBarProps) => {
  const { t } = useTranslation();

  // Log sticky bar shown event
  useEffect(() => {
    logEvent('refly_nexu_workbench_sticky_shown');
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    logEvent('refly_nexu_workbench_sticky_click');
    window.open(NEXU_URL, '_blank');
  }, []);

  return (
    <a
      href={NEXU_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cn(
        'group flex items-center gap-2 px-4 py-2.5 rounded-lg',
        'bg-gradient-to-r from-[#f8f9fa] to-[#e9ecef] dark:from-[#2a2a2a] dark:to-[#1a1a1a]',
        'border border-solid border-[#dee2e6] dark:border-[#404040]',
        'hover:border-[#0E9F77] hover:shadow-sm',
        'transition-all duration-200 cursor-pointer no-underline',
        className,
      )}
    >
      <NexuIcon size={20} className="text-[#2c2a2b] dark:text-white flex-shrink-0" />
      <span className="text-sm text-[#2c2a2b] dark:text-gray-200 flex-1 truncate">
        <span className="font-semibold">nexu</span>
        <span className="mx-1">:</span>
        {t('nexuPromotion.stickyBar.text')}
      </span>
      <LuArrowRight
        size={18}
        className="text-[#2c2a2b] dark:text-gray-200 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
      />
    </a>
  );
});

NexuStickyBar.displayName = 'NexuStickyBar';
