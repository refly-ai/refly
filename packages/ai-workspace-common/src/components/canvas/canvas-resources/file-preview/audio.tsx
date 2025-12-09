import { memo } from 'react';
import type { FileRendererProps } from './types';

export const AudioRenderer = memo(({ fileContent }: FileRendererProps) => {
  const { url } = fileContent;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <audio src={url} controls className="w-full max-w-md" preload="metadata">
          <track kind="captions" />
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  );
});
