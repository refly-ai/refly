import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ResourceDetail } from '@refly-packages/ai-workspace-common/components/detail/resource-detail';
import { DetailTopBar } from '../../components/detail-top-bar';

const ResourceDetailPage = React.memo(() => {
  const { t } = useTranslation();
  const { resId } = useParams();

  if (!resId) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-gray-500">{t('common.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      <DetailTopBar />
      <div className="flex-grow overflow-y-auto py-4">
        <ResourceDetail resourceId={resId} />
      </div>
    </div>
  );
});

ResourceDetailPage.displayName = 'ResourceDetailPage';

export default ResourceDetailPage;
