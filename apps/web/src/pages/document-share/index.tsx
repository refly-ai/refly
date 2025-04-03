import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Result } from 'antd';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { useEffect, useCallback } from 'react';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import PoweredByRefly from '@/components/common/PoweredByRefly';

const DocumentSharePage = () => {
  const { shareId = '' } = useParams();
  const { t } = useTranslation();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { data: documentData, loading: isLoading } = useFetchShareData(shareId);

  // Force collapse by default
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setCollapse(!collapse);
  }, [collapse, setCollapse]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full grow items-center justify-center">
        <div className="text-gray-500">
          {t('document.shareLoading', 'Loading shared document...')}
        </div>
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Result
          status="404"
          title={t('document.notFound', 'Document Not Found')}
          subTitle={t(
            'document.notFoundDesc',
            'The document you are looking for does not exist or has been removed.',
          )}
        />
      </div>
    );
  }

  const { title, content } = documentData;

  return (
    <div className="flex h-full w-full grow relative">
      {collapse && <PoweredByRefly onClick={toggleSidebar} />}

      {/* Main content */}
      <div className="flex h-full w-full grow bg-white overflow-auto">
        <div className="flex flex-col space-y-4 p-4 h-full max-w-[1024px] mx-auto w-full">
          {title && <h1 className="text-3xl font-bold text-gray-800 mt-6 mb-4">{title}</h1>}

          <div className="flex-grow prose prose-lg max-w-full">
            {content && <Markdown content={content} mode="readonly" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSharePage;
