import { memo, useState } from 'react';
import type { CanvasNode, ImageNodeMeta } from '@refly/canvas-common';
import type { IContextItem } from '@refly/common-types';
import type { ModelInfo } from '@refly/openapi-schema';
import { PreviewChatInput } from './skill-response/preview-chat-input';
import { EditChatInput } from './skill-response/edit-chat-input';
import { cn } from '@refly/utils/cn';
//import { ActionContainer } from './skill-response/action-container';
import { SourceListModal } from '@refly-packages/ai-workspace-common/components/source-list/source-list-modal';
import { MediaActionContainer } from './media-action-container';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';

interface ImageNodePreviewProps {
  node: CanvasNode<ImageNodeMeta>;
}

const ImageNodePreviewComponent = ({ node }: ImageNodePreviewProps) => {
  const imageUrl = node?.data?.metadata?.imageUrl ?? '';
  const title = node?.data?.title ?? 'Image';
  const contextItems: IContextItem[] = node?.data?.metadata?.contextItems ?? [];
  const resultId = node?.data?.metadata?.resultId ?? '';
  const modelInfo: ModelInfo | undefined = node?.data?.metadata?.modelInfo;
  const [editMode, setEditMode] = useState(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

  if (!imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        No image to preview
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col gap-4 max-w-[1024px] mx-auto overflow-hidden relative"
      onClick={() => {
        if (editMode) {
          setEditMode(false);
        }
      }}
    >
      {/* Chat Input Section */}
      <div className="px-4 pt-4">
        <EditChatInput
          enabled={editMode}
          resultId={resultId}
          contextItems={contextItems}
          query={title}
          modelInfo={
            modelInfo ?? {
              name: '',
              label: '',
              provider: '',
              contextLimit: 0,
              maxOutput: 0,
            }
          }
          setEditMode={setEditMode}
        />
        <PreviewChatInput
          enabled={!editMode}
          contextItems={contextItems}
          query={title}
          setEditMode={setEditMode}
        />
      </div>

      {/* Image Preview Section */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <div
          className={cn(
            'w-full h-full flex items-center justify-center transition-opacity duration-500',
            { 'opacity-30': editMode },
          )}
        >
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
            loading="lazy"
            referrerPolicy="no-referrer"
            onClick={() => setIsPreviewModalVisible(true)}
          />
        </div>
      </div>

      <MediaActionContainer
        title={title}
        contextItems={contextItems}
        modelInfo={modelInfo ?? null}
        mediaType={'image'}
        resultId={resultId}
        storageKey={node?.data?.metadata?.storageKey ?? ''}
      />
      <SourceListModal classNames="w-full h-full" />

      {/* Image Preview Modal */}
      <div className="absolute inset-0 pointer-events-none">
        <ImagePreview
          isPreviewModalVisible={isPreviewModalVisible}
          setIsPreviewModalVisible={setIsPreviewModalVisible}
          imageUrl={imageUrl}
        />
      </div>
    </div>
  );
};

export const ImageNodePreview = memo(ImageNodePreviewComponent, (prevProps, nextProps) => {
  // Always re-render if node ID changes (new node)
  if (prevProps?.node?.id !== nextProps?.node?.id) {
    return false;
  }

  // Check if any relevant data has changed
  return (
    prevProps?.node?.data?.metadata?.imageUrl === nextProps?.node?.data?.metadata?.imageUrl &&
    prevProps?.node?.data?.title === nextProps?.node?.data?.title &&
    prevProps?.node?.data?.metadata?.contextItems ===
      nextProps?.node?.data?.metadata?.contextItems &&
    prevProps?.node?.data?.metadata?.resultId === nextProps?.node?.data?.metadata?.resultId &&
    prevProps?.node?.data?.metadata?.modelInfo === nextProps?.node?.data?.metadata?.modelInfo
  );
});

ImageNodePreview.displayName = 'ImageNodePreview';
