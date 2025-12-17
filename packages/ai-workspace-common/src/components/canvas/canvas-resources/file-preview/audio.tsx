import { memo, useRef, useEffect } from 'react';
import type { FileRendererProps } from './types';
import { audioManager } from './audio-manager';

export const AudioRenderer = memo(({ fileContent }: FileRendererProps) => {
  const { url } = fileContent;
  const audioRef = useRef<HTMLAudioElement>(null);

  // Register audio element with audio manager
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    const unregister = audioManager.register(audioElement);
    return unregister;
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <audio ref={audioRef} src={url} controls className="w-full max-w-md" preload="metadata">
          <track kind="captions" />
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  );
});
