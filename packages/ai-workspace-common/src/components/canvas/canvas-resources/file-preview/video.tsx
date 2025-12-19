import { memo } from 'react';
import type { FileRendererProps } from './types';

export const VideoRenderer = memo(({ fileContent }: FileRendererProps) => {
  const { url } = fileContent;

  return (
    <div className="w-full flex items-center justify-center">
      <video
        src={url}
        controls
        className="w-full max-w-[900px] h-auto rounded-lg"
        preload="metadata"
      >
        <track kind="captions" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
});
