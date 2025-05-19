import { memo, useState } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';
import { useTranslation } from 'react-i18next';

// Image renderer component
const ImageRenderer = memo(
  ({
    node,
    isFullscreen = false,
    isMinimap = false,
  }: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isMinimap?: boolean;
  }) => {
    const { t } = useTranslation();
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

    // Get image URL from node data
    const imageUrl = node.nodeData?.metadata?.imageUrl;
    const title = node.nodeData?.title || t('pages.components.image.defaultTitle');

    // If no image URL, show a prompt
    if (!imageUrl) {
      return (
        <div className="h-full flex items-center justify-center bg-white rounded p-3">
          <span className="text-gray-500">{t('pages.components.image.notFound')}</span>
        </div>
      );
    }

    const handleOpenPreview = () => {
      setIsPreviewModalVisible(true);
    };

    return (
      <div
        className={`h-full bg-white dark:bg-gray-900 ${!isFullscreen ? 'rounded' : 'w-full'} ${
          isMinimap ? 'p-1' : ''
        }`}
      >
        <div className="h-full w-full overflow-hidden flex flex-col">
          {/* Image content area */}
          <div className="flex-1 overflow-auto p-4 dark:bg-gray-900">
            <div
              className="cursor-pointer hover:opacity-90 transition-opacity"
              onClick={handleOpenPreview}
            >
              <img
                src={imageUrl}
                alt={title}
                className="max-w-full max-h-full object-contain mx-auto"
              />
            </div>
          </div>

          {/* Preview modal */}
          {isPreviewModalVisible && (
            <ImagePreview
              isPreviewModalVisible={isPreviewModalVisible}
              setIsPreviewModalVisible={setIsPreviewModalVisible}
              imageUrl={imageUrl}
              imageTitle={title}
            />
          )}
        </div>
      </div>
    );
  },
);

export { ImageRenderer };
