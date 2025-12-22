import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Result } from 'antd';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { useCallback, useState } from 'react';
import { FilePreview } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/file-preview';
import { DriveFile } from '@refly/openapi-schema';
import PoweredByRefly from '../../components/common/PoweredByRefly';

const DriveFileSharePage = () => {
  const { shareId = '' } = useParams();
  const { t } = useTranslation();

  const { data: driveFileData, loading: isLoading } = useFetchShareData(shareId);
  const [showBranding, setShowBranding] = useState(true);

  console.log('driveFileData', driveFileData);

  // Handle close button click
  const handleClose = useCallback(() => {
    setShowBranding(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full w-full grow items-center justify-center">
        <div className="text-gray-500">{t('driveFile.shareLoading', 'Loading shared file...')}</div>
      </div>
    );
  }

  if (!driveFileData) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Result
          status="404"
          title={t('driveFile.notFound', 'File Not Found')}
          subTitle={t(
            'driveFile.notFoundDesc',
            'The file you are looking for does not exist or has been removed.',
          )}
        />
      </div>
    );
  }

  const file = driveFileData as DriveFile;

  // Check if file is HTML
  const isHtmlFile =
    file.name?.toLowerCase().endsWith('.html') ||
    file.name?.toLowerCase().endsWith('.htm') ||
    file.type?.toLowerCase().includes('text/html');

  return (
    <div className="flex h-full w-full grow relative">
      {showBranding && <PoweredByRefly onClose={handleClose} />}

      {/* Main content */}
      <div className="flex h-full w-full grow bg-white dark:bg-black overflow-auto">
        <div
          className={`flex flex-col space-y-4 ${isHtmlFile ? 'p-0' : 'p-4'} h-full ${isHtmlFile ? 'w-full' : 'max-w-[1024px] mx-auto w-full'}`}
        >
          {!isHtmlFile && file.name && (
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mt-6 mb-4">
              {file.name}
            </h1>
          )}

          {!isHtmlFile && file.summary && (
            <div className="text-gray-600 dark:text-gray-400 mb-4">{file.summary}</div>
          )}

          <div className={`flex-grow h-full ${isHtmlFile ? '' : 'pb-16'}`}>
            <FilePreview file={file} source="preview" disableTruncation purePreview={isHtmlFile} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveFileSharePage;
