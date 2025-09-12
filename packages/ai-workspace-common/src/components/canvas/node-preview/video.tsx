import { memo, useState } from 'react';
import type { CanvasNode } from '@refly/canvas-common';
import type { IContextItem } from '@refly/common-types';
import type { ModelInfo } from '@refly/openapi-schema';
import { PreviewChatInput } from './skill-response/preview-chat-input';
import { EditChatInput } from './skill-response/edit-chat-input';
import { cn } from '@refly/utils/cn';
import { MediaActionContainer } from './media-action-container';

type VideoNodeMeta = {
  videoUrl?: string;
  storageKey?: string;
  showTitle?: boolean;
  contextItems?: IContextItem[];
  resultId?: string;
  modelInfo?: ModelInfo;
};

interface VideoNodePreviewProps {
  node: CanvasNode<VideoNodeMeta>;
}

const VideoNodePreviewComponent = ({ node }: VideoNodePreviewProps) => {
  const videoUrl = node?.data?.metadata?.videoUrl ?? '';
  const title = node?.data?.title ?? 'Video';
  const contextItems: IContextItem[] = node?.data?.metadata?.contextItems ?? [];
  const resultId = node?.data?.metadata?.resultId ?? '';
  const entityId = node?.data?.entityId ?? '';
  const modelInfo: ModelInfo | undefined = node?.data?.metadata?.modelInfo;
  const [editMode, setEditMode] = useState(false);

  if (!videoUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-refly-text-2 text-sm">
        No video to preview
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col gap-4 max-w-[1024px] mx-auto overflow-hidden"
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

      {/* Video Preview Section */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <div
          className={cn(
            'w-full h-full flex items-center justify-center transition-opacity duration-500',
            { 'opacity-30': editMode },
          )}
        >
          <video
            src={videoUrl}
            controls
            className="max-w-full max-h-full object-contain"
            preload="metadata"
            aria-label={title}
          >
            <track kind="captions" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
      <MediaActionContainer
        title={title}
        contextItems={contextItems}
        modelInfo={modelInfo ?? null}
        mediaType={'video'}
        entityId={entityId}
        nodeId={node.id}
        storageKey={node?.data?.metadata?.storageKey ?? ''}
      />
    </div>
  );
};

export const VideoNodePreview = memo(
  VideoNodePreviewComponent,
  (prevProps, nextProps) =>
    prevProps?.node?.data?.metadata?.videoUrl === nextProps?.node?.data?.metadata?.videoUrl &&
    prevProps?.node?.data?.title === nextProps?.node?.data?.title &&
    prevProps?.node?.data?.metadata?.contextItems ===
      nextProps?.node?.data?.metadata?.contextItems &&
    prevProps?.node?.data?.metadata?.resultId === nextProps?.node?.data?.metadata?.resultId &&
    prevProps?.node?.data?.metadata?.modelInfo === nextProps?.node?.data?.metadata?.modelInfo,
);

VideoNodePreview.displayName = 'VideoNodePreview';
