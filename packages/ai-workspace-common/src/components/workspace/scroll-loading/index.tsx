import { useTranslation } from 'react-i18next';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

export const Spinner = () => {
  return (
    <div className="flex justify-center py-4">
      <Spin />
    </div>
  );
};

export const EndMessage = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full flex justify-center py-6">
      <span>{t('knowledgeLibrary.archive.item.noMoreText')}</span>
    </div>
  );
};
