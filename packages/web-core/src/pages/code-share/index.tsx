import { useParams } from 'react-router-dom';
import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Renderer from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/render';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import PoweredByRefly from '../../components/common/PoweredByRefly';

const ShareCodePage = () => {
  const { shareId = '' } = useParams();
  const { t } = useTranslation();

  const { data: codeData, loading: isLoading } = useFetchShareData(shareId);
  const [showBranding, setShowBranding] = useState(true);

  // Handle close button click
  const handleClose = useCallback(() => {
    setShowBranding(false);
  }, []);

  // Memoize the render key to prevent unnecessary re-renders
  const renderKey = useMemo(() => Date.now().toString(), [codeData?.content]);

  // Handle error reporting (no-op in read-only view)
  const handleRequestFix = useCallback(() => {}, []);

  if (isLoading) {
    return (
      <div className="flex h-full w-full grow items-center justify-center">
        <div className="text-gray-500">{t('codeArtifact.shareLoading')}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full grow relative">
      {showBranding && <PoweredByRefly onClose={handleClose} />}

      <div className="absolute w-[calc(100vw-12px)] h-16 bottom-0 left-0 right-0 box-border flex justify-between items-center py-2 px-4 pr-0 bg-transparent">
        {/* Removed the collapse button since we now use PoweredByRefly for toggling */}
      </div>

      {/* Main content */}
      <div className="flex h-full w-full grow items-center justify-center bg-white dark:bg-gray-900 overflow-hidden">
        {codeData?.content ? (
          <div className="w-full h-full">
            <Renderer
              content={codeData.content}
              type={codeData.type}
              key={renderKey}
              title={codeData.title}
              language={codeData.language}
              readonly
              onRequestFix={handleRequestFix}
              showActions={false}
            />
          </div>
        ) : (
          <div className="text-gray-500">{t('codeArtifact.noCodeFound')}</div>
        )}
      </div>
    </div>
  );
};

export default ShareCodePage;
