import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownMode } from '../../types';
import { ToolOutlined, SoundOutlined, PauseOutlined } from '@ant-design/icons';
import { ImagePreview } from '@refly-packages/ai-workspace-common/components/common/image-preview';

// Audio Player Component
interface AudioPlayerProps {
  audioUrl: string;
  audioName?: string;
  audioFormat?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  audioName = 'audio',
  audioFormat = 'flac',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Format time to display as MM:SS
  const formatTime = (time: number) => {
    if (Number.isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle play/pause toggle
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Handle metadata loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Handle progress bar change
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number.parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Handle audio ended
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className="my-3 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <SoundOutlined className="mr-2 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{audioName}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{audioFormat.toUpperCase()}</div>
      </div>

      <div className="px-4 pb-3 pt-1">
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={togglePlay}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <PauseOutlined className="text-gray-700 dark:text-gray-300" />
            ) : (
              <span className="text-gray-700 dark:text-gray-300 ml-0.5">▶</span>
            )}
          </button>

          <div className="text-xs text-gray-600 dark:text-gray-400 w-10 text-center">
            {formatTime(currentTime)}
          </div>

          <div className="flex-1 mx-1">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleProgressChange}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #2563eb ${(currentTime / (duration || 1)) * 100}%, #e5e7eb ${(currentTime / (duration || 1)) * 100}%)`,
              }}
            />
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-400 w-10 text-center">
            {formatTime(duration)}
          </div>

          <div className="flex items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-14 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #2563eb ${volume * 100}%, #e5e7eb ${volume * 100}%)`,
              }}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      >
        <track kind="captions" src="" label="English" />
      </audio>
    </div>
  );
};

// SVG icons for the component
const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-[18px] h-[18px] text-green-500 dark:text-green-400"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

interface MCPCallProps {
  'data-tool-name'?: string;
  'data-tool-arguments'?: string;
  'data-tool-result'?: string;
  'data-tool-type'?: 'use' | 'result';
  'data-tool-image-base64-url'?: string;
  'data-tool-image-http-url'?: string;
  'data-tool-image-name'?: string;
  'data-tool-audio-http-url'?: string;
  'data-tool-audio-name'?: string;
  'data-tool-audio-format'?: string;
  id?: string;
  mode?: MarkdownMode;
}

/**
 * MCPCall component renders tool_use and tool_use_result tags as collapsible panels
 * similar to the Cursor MCP UI seen in the screenshot
 */
const MCPCall: React.FC<MCPCallProps> = (props) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  // Extract tool name from props
  const toolName = useMemo(() => props['data-tool-name'] || 'unknown', [props]);

  // Format the content for parameters
  const parametersContent = useMemo(() => {
    try {
      const argsStr = props['data-tool-arguments'] || '{}';
      const args = JSON.parse(argsStr);
      return Object.keys(args).length
        ? JSON.stringify(args, null, 2)
        : t('components.markdown.noParameters', 'No parameters');
    } catch (_e) {
      return props['data-tool-arguments'] || t('components.markdown.noParameters', 'No parameters');
    }
  }, [props, t]);

  // Format the content for result
  const resultContent = useMemo(() => props['data-tool-result'] || '', [props]);

  // Check if result exists
  const hasResult = !!resultContent;

  // Image props
  const imageBase64Url = props['data-tool-image-base64-url'];
  const imageHttpUrl = props['data-tool-image-http-url'];
  const imageName = props['data-tool-image-name'];
  const imageUrl = imageBase64Url || imageHttpUrl;

  // Audio props
  const audioHttpUrl = props['data-tool-audio-http-url'];
  const audioName = props['data-tool-audio-name'];
  const audioFormat = props['data-tool-audio-format'];

  return (
    <>
      <div className="my-3 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 text-black dark:text-gray-100 font-mono shadow-md">
        {/* Header bar */}
        <div
          className="flex items-center px-4 py-2 cursor-pointer select-none bg-gray-50 dark:bg-gray-700 min-h-[44px]"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {/* ToolOutlined now serves as the toggle icon with rotation */}
          <ToolOutlined
            className="text-gray-500 dark:text-gray-400"
            style={{
              fontSize: '16px',
              marginRight: '12px', // Adjusted margin for spacing
              transition: 'transform 0.2s ease-in-out',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          />
          {/* Tool name displayed as the main text in the header */}
          <div className="flex-1 text-[15px] font-medium tracking-tight text-gray-900 dark:text-gray-100">
            {toolName}
          </div>
          {/* Check icon for results, with adjusted margin */}
          {hasResult && (
            <span className="ml-2 flex items-center">
              {' '}
              {/* Adjusted margin from ml-1 to ml-2 */}
              <CheckIcon />
            </span>
          )}
        </div>

        {/* Content section */}
        {!isCollapsed && (
          <div className="border-t border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2">
            {/* Parameters section always shown */}
            <div>
              <div className="px-5 py-1 text-gray-600 dark:text-gray-400 text-[13px] border-b border-gray-300 dark:border-gray-600 font-normal">
                {t('components.markdown.parameters', 'Parameters:')}
              </div>
              {/* Parameter content block with background, rounded corners, margin and padding */}
              <div className="mx-4 my-2 rounded-md bg-gray-100 dark:bg-gray-700 px-4 py-3 font-mono text-[15px] font-normal whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-[22px]">
                {parametersContent}
              </div>
            </div>
            {/* Result section only if hasResult */}
            {hasResult && (
              <div>
                <div className="px-5 py-1 text-gray-600 dark:text-gray-400 text-[13px] border-b border-gray-300 dark:border-gray-600 font-normal">
                  {t('components.markdown.result', 'Result:')}
                </div>
                {/* Result content block with background, rounded corners, margin and padding */}
                <div className="mx-4 my-2 rounded-md bg-gray-100 dark:bg-gray-700 px-4 py-3 font-mono text-[15px] font-normal whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-[22px]">
                  {resultContent}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Preview section - styled as a separate card below the main MCPCall card */}
      {imageUrl && imageName && (
        <div className="mb-3 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden cursor-pointer bg-white dark:bg-gray-800">
          <div className="px-2 py-2 flex flex-col items-center">
            <img
              src={imageUrl}
              alt={imageName}
              className="max-w-full h-auto rounded-md shadow-md max-h-[300px]"
              onClick={() => {
                setPreviewImageUrl(imageUrl);
                setIsPreviewModalVisible(true);
              }}
            />
          </div>
          {/* Image Preview Component */}
          <div className="w-0 h-0">
            <ImagePreview
              isPreviewModalVisible={isPreviewModalVisible}
              setIsPreviewModalVisible={setIsPreviewModalVisible}
              imageUrl={previewImageUrl}
              imageTitle={imageName}
            />
          </div>
        </div>
      )}

      {/* Audio Player section */}
      {audioHttpUrl && audioFormat && (
        <AudioPlayer audioUrl={audioHttpUrl} audioName={audioName} audioFormat={audioFormat} />
      )}
    </>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(MCPCall);
