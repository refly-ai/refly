import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from 'antd';
import { PlayCircleOutlined, LoadingOutlined } from '@ant-design/icons';

/**
 * Video placeholder component following Figma design specifications
 * - Size: 1072px × 480px (responsive)
 * - Background: #2D2D2D (dark gray)
 * - Border radius: 20px
 * - Play button: 48px × 48px
 * - Loading state: Black placeholder block
 * - Cover image before video loads
 * - Optimized with preloading and performance enhancements
 */
const VideoPlaceholder: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [videoPreloaded, setVideoPreloaded] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadVideoRef = useRef<HTMLVideoElement | null>(null);

  // Demo video URL - Using a more reliable video source
  const demoVideoUrl =
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  // Demo cover image URL - Using a more reliable image source
  const coverImageUrl =
    'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=1072&h=480&fit=crop&crop=center';

  // Memoized handlers to prevent unnecessary re-renders
  const handlePlayClick = useCallback(() => {
    if (videoPreloaded) {
      setIsPlaying(true);
      // Auto play when preloaded
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch((error) => {
            console.warn('Auto-play failed:', error);
          });
        }
      }, 100);
    } else {
      setIsLoading(true);
      setIsPlaying(true);
    }
  }, [videoPreloaded]);

  const handleVideoLoad = useCallback(() => {
    setIsLoading(false);
    setLoadError(false);
    // Auto play when video is loaded
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.play().catch((error) => {
        console.warn('Auto-play failed:', error);
        // Fallback: user needs to manually click play
      });
    }
  }, []);

  const handleVideoError = useCallback(() => {
    setIsLoading(false);
    setLoadError(true);
    setIsPlaying(false);
  }, []);

  const handleCoverLoad = useCallback(() => {
    setCoverLoaded(true);
  }, []);

  const handleCoverError = useCallback(() => {
    setCoverLoaded(false);
  }, []);

  const handlePreloadProgress = useCallback((event: Event) => {
    const video = event.target as HTMLVideoElement;
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const duration = video.duration;
      if (duration > 0) {
        const progress = (bufferedEnd / duration) * 100;
        setPreloadProgress(Math.min(progress, 100));
      }
    }
  }, []);

  const handlePreloadComplete = useCallback(() => {
    setVideoPreloaded(true);
    setPreloadProgress(100);
  }, []);

  const handlePreloadError = useCallback(() => {
    setVideoPreloaded(false);
    setPreloadProgress(0);
  }, []);

  // Preload cover image with error handling and caching
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = handleCoverLoad;
    img.onerror = handleCoverError;
    img.src = coverImageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [coverImageUrl, handleCoverLoad, handleCoverError]);

  // Preload video in background for instant playback
  useEffect(() => {
    const preloadVideo = document.createElement('video');
    preloadVideo.crossOrigin = 'anonymous';
    preloadVideo.muted = true;
    preloadVideo.preload = 'auto';
    preloadVideo.style.display = 'none';

    preloadVideo.addEventListener('progress', handlePreloadProgress);
    preloadVideo.addEventListener('canplaythrough', handlePreloadComplete);
    preloadVideo.addEventListener('error', handlePreloadError);
    preloadVideo.addEventListener('loadeddata', handlePreloadComplete);

    preloadVideo.src = demoVideoUrl;
    preloadVideo.load();

    preloadVideoRef.current = preloadVideo;

    return () => {
      preloadVideo.removeEventListener('progress', handlePreloadProgress);
      preloadVideo.removeEventListener('canplaythrough', handlePreloadComplete);
      preloadVideo.removeEventListener('error', handlePreloadError);
      preloadVideo.removeEventListener('loadeddata', handlePreloadComplete);
      preloadVideo.src = '';
      preloadVideo.load();
    };
  }, [demoVideoUrl, handlePreloadProgress, handlePreloadComplete, handlePreloadError]);

  // Reset states when component mounts
  useEffect(() => {
    setIsLoading(false);
    setLoadError(false);
    setIsPlaying(false);
    setCoverLoaded(false);
    setVideoPreloaded(false);
    setPreloadProgress(0);
  }, []);

  // Memoized video source to prevent unnecessary re-renders
  const videoSource = useMemo(() => demoVideoUrl, [demoVideoUrl]);

  // Auto play video when it's ready
  useEffect(() => {
    if (isPlaying && videoRef.current && !loadError) {
      const video = videoRef.current;

      const playVideo = async () => {
        try {
          await video.play();
          console.log('Video auto-played successfully');
        } catch (error) {
          console.warn('Auto-play failed, user interaction required:', error);
          // Video will need user interaction to play
        }
      };

      // Try to play immediately if video is ready
      if (video.readyState >= 3) {
        // HAVE_FUTURE_DATA
        playVideo();
      } else {
        // Wait for video to be ready
        const handleCanPlay = () => {
          playVideo();
          video.removeEventListener('canplay', handleCanPlay);
        };
        video.addEventListener('canplay', handleCanPlay);

        return () => {
          video.removeEventListener('canplay', handleCanPlay);
        };
      }
    }
  }, [isPlaying, loadError]);

  return (
    <div className="w-full max-w-[1072px] mx-auto px-4">
      <div
        className="relative w-full rounded-[20px] overflow-hidden"
        style={{
          aspectRatio: '1072/480',
          backgroundColor: '#2D2D2D',
          minHeight: '200px',
          maxHeight: '480px',
        }}
      >
        {isLoading ? (
          /* Loading state - Black placeholder block following Figma design */
          <div className="w-full h-full flex items-center justify-center relative bg-[#2D2D2D]">
            <div className="flex flex-col items-center gap-4">
              <LoadingOutlined
                className="text-white text-4xl animate-spin"
                style={{ fontSize: '48px' }}
              />
              <span className="text-white text-sm opacity-70">
                {videoPreloaded ? 'Starting playback...' : 'Loading video...'}
              </span>
              {!videoPreloaded && preloadProgress > 0 && (
                <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/60 transition-all duration-300 ease-out"
                    style={{ width: `${preloadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : isPlaying && !loadError ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            controls
            autoPlay
            muted
            playsInline
            preload="none"
            src={videoSource}
            onLoadedData={handleVideoLoad}
            onCanPlay={handleVideoLoad}
            onError={handleVideoError}
            onPlay={() => {
              // Ensure video is playing
              console.log('Video started playing');
            }}
            onPause={() => {
              // Handle pause if needed
              console.log('Video paused');
            }}
          >
            <track kind="captions" srcLang="en" label="English" />
            Your browser does not support the video tag.
          </video>
        ) : (
          /* Video cover - Black placeholder with cover image and play button */
          <div className="w-full h-full flex items-center justify-center relative bg-[#2D2D2D]">
            {/* Cover image */}
            {coverLoaded ? (
              <img
                src={coverImageUrl}
                alt="Video cover"
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              /* Black placeholder while cover loads */
              <div className="w-full h-full bg-[#2D2D2D]" />
            )}

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Button
                type="text"
                size="large"
                className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 transition-all duration-200"
                onClick={handlePlayClick}
                style={{
                  width: '48px',
                  height: '48px',
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <PlayCircleOutlined className="text-white text-2xl" style={{ fontSize: '24px' }} />
              </Button>

              {/* Preload progress indicator */}
              {!videoPreloaded && preloadProgress > 0 && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 text-white text-xs opacity-70">
                    <span>Preloading...</span>
                    <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/60 transition-all duration-300 ease-out"
                        style={{ width: `${preloadProgress}%` }}
                      />
                    </div>
                    <span>{Math.round(preloadProgress)}%</span>
                  </div>
                </div>
              )}

              {/* Ready indicator */}
              {videoPreloaded && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-white text-xs opacity-70 text-center">Ready to play</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Memoized component to prevent unnecessary re-renders
const MemoizedVideoPlaceholder = React.memo(VideoPlaceholder);

export default MemoizedVideoPlaceholder;
