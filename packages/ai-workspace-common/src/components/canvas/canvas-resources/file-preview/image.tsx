import { memo, useState } from 'react';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';
import type { FileRendererProps } from './types';

export const ImageRenderer = memo(({ fileContent, file }: FileRendererProps) => {
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const { url } = fileContent;

  return (
    <div className="h-full flex items-center justify-center max-w-[1024px] mx-auto overflow-hidden relative">
      <img
        src={url}
        alt={file.name}
        className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity rounded-lg"
        loading="lazy"
        onClick={() => setIsPreviewModalVisible(true)}
      />

      {/* Image Preview Modal */}
      <div className="absolute inset-0 pointer-events-none">
        <ImagePreview
          isPreviewModalVisible={isPreviewModalVisible}
          setIsPreviewModalVisible={setIsPreviewModalVisible}
          imageUrl={url}
        />
      </div>
    </div>
  );
});
