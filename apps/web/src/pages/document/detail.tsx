import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocumentEditor } from '@refly-packages/ai-workspace-common/components/document';

const DocumentDetailPage = React.memo(() => {
  const { t } = useTranslation();
  const { docId } = useParams();

  if (!docId) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-gray-500">{t('common.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      <div className="flex-grow overflow-y-auto py-4">
        <DocumentEditor source="detail" docId={docId} />
      </div>
    </div>
  );
});

DocumentDetailPage.displayName = 'DocumentDetailPage';

export default DocumentDetailPage;
