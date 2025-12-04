import { memo } from 'react';
import type { FileRendererProps } from './types';

export const VideoRenderer = memo(({ fileContent }: FileRendererProps) => {
  const { url } = fileContent;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <video
          src={url}
          controls
          className="max-w-full max-h-full object-contain rounded-lg"
          preload="metadata"
        >
          <track kind="captions" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
});
