import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Skeleton } from '@arco-design/web-react';

export interface ScrollLoadingProps {
  isRequesting: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export const ScrollLoading = (props: ScrollLoadingProps) => {
  const { isRequesting, hasMore, loadMore } = props;

  const { t } = useTranslation();

  if (!hasMore) {
    return <span style={{ marginBottom: 32 }}>{t('knowledgeLibrary.archive.item.noMoreText')}</span>;
  }

  if (isRequesting) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <Skeleton animation style={{ width: '100%' }}></Skeleton>
        <Skeleton animation style={{ width: '100%', marginTop: 24 }}></Skeleton>
      </div>
    );
  }

  return (
    <Button onClick={() => loadMore()} style={{ marginBottom: 32 }}>
      {t('common.loadMore')}
    </Button>
  );
};
