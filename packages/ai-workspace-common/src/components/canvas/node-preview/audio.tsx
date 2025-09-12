import { memo, useCallback, useEffect, useState } from 'react';
import type { CanvasNode } from '@refly/canvas-common';
import type { IContextItem } from '@refly/common-types';
import type { ModelInfo } from '@refly/openapi-schema';
import { PreviewChatInput } from './skill-response/preview-chat-input';
import { EditChatInput } from './skill-response/edit-chat-input';
import { cn } from '@refly/utils/cn';
import { MediaActionContainer } from './media-action-container';

type AudioNodeMeta = {
  audioUrl?: string;
  storageKey?: string;
  showTitle?: boolean;
  contextItems?: IContextItem[];
  resultId?: string;
  modelInfo?: ModelInfo;
};

interface AudioNodePreviewProps {
  node: CanvasNode<AudioNodeMeta>;
}

const FALLBACK_AUDIO_URLS = [
  'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
  'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav',
];

const AudioNodePreviewComponent = ({ node }: AudioNodePreviewProps) => {
  const originalUrl = node?.data?.metadata?.audioUrl ?? '';
  const title = node?.data?.title ?? 'Audio';
  const contextItems: IContextItem[] = node?.data?.metadata?.contextItems ?? [];
  const resultId = node?.data?.metadata?.resultId ?? '';
  const modelInfo: ModelInfo | undefined = node?.data?.metadata?.modelInfo;
  const [currentUrl, setCurrentUrl] = useState(originalUrl);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const entityId = node?.data?.entityId ?? '';
  useEffect(() => {
    setCurrentUrl(originalUrl);
    setFallbackIndex(0);
    setHasError(false);
  }, [originalUrl]);

  const handleError = useCallback(() => {
    if (fallbackIndex < FALLBACK_AUDIO_URLS.length) {
      setCurrentUrl(FALLBACK_AUDIO_URLS[fallbackIndex] ?? '');
      setFallbackIndex((idx) => idx + 1);
      setHasError(false);
    } else {
      setHasError(true);
    }
  }, [fallbackIndex]);

  if (!originalUrl && FALLBACK_AUDIO_URLS.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        No audio to preview
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

      {/* Audio Preview Section */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <div
          className={cn(
            'w-full h-full flex py-5 px-4 items-center justify-center transition-opacity duration-500',
            { 'opacity-30': editMode },
          )}
        >
          {hasError ? (
            <div className="text-center text-refly-text-2 text-sm">Failed to load audio</div>
          ) : (
            <audio
              src={currentUrl}
              controls
              className="w-full"
              preload="metadata"
              aria-label={title}
              onError={handleError}
              onLoadStart={() => setHasError(false)}
            >
              <track kind="captions" />
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      </div>
      <MediaActionContainer
        title={title}
        contextItems={contextItems}
        modelInfo={modelInfo ?? null}
        mediaType={'audio'}
        entityId={entityId}
        nodeId={node.id}
        storageKey={node?.data?.metadata?.storageKey ?? ''}
      />
    </div>
  );
};

export const AudioNodePreview = memo(
  AudioNodePreviewComponent,
  (prevProps, nextProps) =>
    prevProps?.node?.data?.metadata?.audioUrl === nextProps?.node?.data?.metadata?.audioUrl &&
    prevProps?.node?.data?.title === nextProps?.node?.data?.title &&
    prevProps?.node?.data?.metadata?.contextItems ===
      nextProps?.node?.data?.metadata?.contextItems &&
    prevProps?.node?.data?.metadata?.resultId === nextProps?.node?.data?.metadata?.resultId &&
    prevProps?.node?.data?.metadata?.modelInfo === nextProps?.node?.data?.metadata?.modelInfo,
);

AudioNodePreview.displayName = 'AudioNodePreview';
