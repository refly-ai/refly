import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocumentBody } from '@refly-packages/ai-workspace-common/components/document';
import { DocumentProvider } from '@refly-packages/ai-workspace-common/context/document';

const DocumentDetail = React.memo(() => {
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
    <div className="max-w-4xl mx-auto p-6">
      <DocumentProvider docId={docId}>
        <DocumentBody docId={docId} />
      </DocumentProvider>
    </div>
  );
});

DocumentDetail.displayName = 'DocumentDetail';

export default DocumentDetail;
