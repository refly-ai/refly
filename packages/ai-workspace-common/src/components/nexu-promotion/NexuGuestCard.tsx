import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { cn } from '@refly/utils/cn';
import { NexuIcon } from './NexuIcon';
import { logEvent } from '@refly/telemetry-web';
import { LuArrowRight } from 'react-icons/lu';

const NEXU_URL = 'https://nexu.io';

interface NexuGuestCardProps {
  className?: string;
}

export const NexuGuestCard = memo(({ className }: NexuGuestCardProps) => {
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    logEvent('refly_nexu_guest_module_click_nexu');
    window.open(NEXU_URL, '_blank');
  }, []);

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden',
        'bg-gradient-to-br from-[#0E9F77]/10 to-[#0E9F77]/5 dark:from-[#0E9F77]/20 dark:to-[#0E9F77]/10',
        'border border-solid border-[#0E9F77]/20',
        className,
      )}
    >
      <div className="p-4">
        {/* Header with Icon */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#0E9F77] flex items-center justify-center">
            <NexuIcon size={18} className="text-white" />
          </div>
          <span className="font-semibold text-[#0E9F77]">nexu</span>
        </div>

        {/* Title */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
          {t('nexuPromotion.guest.title')}
        </p>

        {/* Features */}
        <div className="space-y-1.5 mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
            <span className="text-[#0E9F77] mt-0.5">*</span>
            {t('nexuPromotion.guest.feature1')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
            <span className="text-[#0E9F77] mt-0.5">*</span>
            {t('nexuPromotion.guest.feature2')}
          </p>
        </div>

        {/* CTA Button */}
        <Button
          type="primary"
          size="small"
          block
          onClick={handleClick}
          className="!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0a7d5e] !h-8 !text-xs"
          icon={<LuArrowRight size={14} />}
          iconPosition="end"
        >
          {t('nexuPromotion.guest.cta')}
        </Button>
      </div>
    </div>
  );
});

NexuGuestCard.displayName = 'NexuGuestCard';
