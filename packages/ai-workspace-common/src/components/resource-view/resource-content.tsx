import { memo, useCallback, useState } from 'react';
import classNames from 'classnames';

import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { genUniqueId } from '@refly/utils/id';
import { SelectionContext } from '@refly-packages/ai-workspace-common/modules/selection-menu/selection-context';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { IContextItem } from '@refly/common-types';
import { Resource } from '@refly/openapi-schema';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';

interface ResourceContentProps {
  resourceDetail: Resource;
  resourceId: string;
}

export const ResourceContent = memo(
  ({ resourceDetail, resourceId }: ResourceContentProps) => {
    const { readonly } = useCanvasContext();
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

    const buildContextItem = useCallback(
      (text: string) => {
        return {
          type: 'resourceSelection',
          entityId: genUniqueId(),
          title: text.slice(0, 50),
          selection: {
            content: text,
            sourceTitle: resourceDetail.title,
            sourceEntityId: resourceDetail.resourceId,
            sourceEntityType: 'resource',
          },
        } as IContextItem;
      },
      [resourceDetail],
    );

    const getSourceNode = useCallback(() => {
      return {
        type: 'resource' as const,
        entityId: resourceId,
      };
    }, [resourceId]);

    const renderMediaContent = () => {
      const resourceType = resourceDetail.resourceType;
      const url = resourceDetail.downloadURL;

      if (resourceType === 'image') {
        if (!url) {
          return (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              No image to preview
            </div>
          );
        }

        return (
          <div className="w-full h-full flex items-center justify-center max-w-[1024px] mx-auto overflow-hidden relative">
            <img
              src={url}
              alt={resourceDetail.title}
              className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
              referrerPolicy="no-referrer"
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
      }

      if (resourceType === 'video') {
        if (!url) {
          return (
            <div className="w-full h-full flex items-center justify-center text-refly-text-2 text-sm">
              No video to preview
            </div>
          );
        }

        return (
          <div className="w-full h-full flex items-center justify-center max-w-[1024px] mx-auto overflow-hidden">
            <video
              src={url}
              controls
              className="max-w-full max-h-full object-contain"
              preload="metadata"
              aria-label={resourceDetail.title}
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          </div>
        );
      }

      if (resourceType === 'audio') {
        if (!url) {
          return (
            <div className="w-full h-full flex items-center justify-center text-refly-text-2 text-sm">
              No audio to preview
            </div>
          );
        }

        return (
          <div className="w-full h-full flex py-5 px-4 items-center justify-center max-w-[1024px] mx-auto overflow-hidden">
            <audio
              src={url}
              controls
              className="w-full"
              preload="metadata"
              aria-label={resourceDetail.title}
            >
              <track kind="captions" />
              Your browser does not support the audio element.
            </audio>
          </div>
        );
      }

      // Default: render markdown content for non-media resources
      return (
        <>
          <Markdown content={resourceDetail?.content || ''} className="text-base" />
          {!readonly && (
            <SelectionContext
              containerClass={`resource-content-${resourceId}`}
              getContextItem={buildContextItem}
              getSourceNode={getSourceNode}
            />
          )}
        </>
      );
    };

    return (
      <div className={classNames(`knowledge-base-resource-content resource-content-${resourceId}`)}>
        <div className="knowledge-base-resource-content-title">{resourceDetail?.title}</div>
        {renderMediaContent()}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.resourceDetail?.resourceId === nextProps.resourceDetail?.resourceId &&
      prevProps.resourceDetail?.content === nextProps.resourceDetail?.content &&
      prevProps.resourceDetail?.resourceType === nextProps.resourceDetail?.resourceType
    );
  },
);
