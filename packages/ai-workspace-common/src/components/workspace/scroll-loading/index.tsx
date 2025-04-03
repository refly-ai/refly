import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

export interface ScrollLoadingProps {
  isRequesting: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export const ScrollLoading = (props: ScrollLoadingProps) => {
  const { isRequesting, hasMore, loadMore } = props;

  const { t } = useTranslation();

  if (!hasMore) {
    return (
      <div className="w-full flex justify-center py-6">
        <span>{t('knowledgeLibrary.archive.item.noMoreText')}</span>
      </div>
    );
  }

  if (isRequesting) {
    return null;
  }

  return (
    <div className="w-full flex justify-center my-6">
      <Button onClick={() => loadMore()}>{t('common.loadMore')}</Button>
    </div>
  );
};

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
