import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useTranslation } from 'react-i18next';

export const ReflyAssistant = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <Logo
        logoProps={{ show: false }}
        textProps={{ show: true, className: 'w-[44px] h-[24px] translate-y-[-1px]' }}
      />
      <div className="text-refly-text-0 text-base font-bold leading-[24px]">
        {t('copilot.assistant')}
      </div>
    </div>
  );
};
