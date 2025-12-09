import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { DriveFile } from '@refly/openapi-schema';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { FilePreview } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/file-preview';
import { Play } from 'refly-icons';
import AudioBgSvg from './audioBg.svg';
import ViewSvg from './view.svg';
import {
  LazyCodeArtifactRenderer,
  LazyDocumentRenderer,
  WithSuspense,
} from '@refly-packages/ai-workspace-common/components/slideshow/components/LazyComponents';
import { NodeRelation } from '@refly-packages/ai-workspace-common/components/slideshow/components/ArtifactRenderer';
import { Modal } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';
import { NodeRenderer } from '@refly-packages/ai-workspace-common/components/slideshow/components/NodeRenderer';
import {
  PublicFileUrlProvider,
  usePublicFileUrlContext,
} from '@refly-packages/ai-workspace-common/context/public-file-url';
import { logEvent } from '@refly/telemetry-web';

// Global media manager to stop all playing media
const mediaManager = {
  stopFunctions: new Set<() => void>(),
  register: (stopFn: () => void) => {
    mediaManager.stopFunctions.add(stopFn);
    return () => {
      mediaManager.stopFunctions.delete(stopFn);
    };
  },
  stopAll: () => {
    for (const stopFn of mediaManager.stopFunctions) {
      try {
        stopFn();
      } catch (error) {
        console.error('Error stopping media:', error);
      }
    }
  },
};

// Image preview component
const ImagePreview = memo(
  ({
    node,
    inModal = false,
  }: { node: CanvasNode; onViewClick?: (nodeId: string) => void; inModal?: boolean }) => {
    const { t } = useTranslation();

    const handleClick = useCallback(() => {
      // Stop all playing media when clicking on image
      mediaManager.stopAll();
    }, []);

    return (
      <div className="w-full h-full relative overflow-hidden" onClick={handleClick}>
        <img
          src={node.data?.metadata?.imageUrl as string}
          alt={node.data?.title || t('common.untitled')}
          className={`w-full h-full ${inModal ? 'object-contain' : 'object-cover'}`}
        />
      </div>
    );
  },
);

ImagePreview.displayName = 'ImagePreview';

// Video preview component with independent state
const VideoPreview = memo(
  ({
    node,
    inModal = false,
  }: { node: CanvasNode; onViewClick?: (nodeId: string) => void; inModal?: boolean }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [progress, setProgress] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Register stop function with media manager
    useEffect(() => {
      const stopVideo = () => {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
          setProgress(0);
        }
      };

      const unregister = mediaManager.register(stopVideo);
      return unregister;
    }, []);

    const handleVideoClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (videoRef.current) {
        if (isPlaying) {
          // If playing, just pause it
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          // If not playing, stop all other media first, then play this one
          mediaManager.stopAll();
          videoRef.current.play().catch((error) => {
            console.error('Error playing video:', error);
          });
          setIsPlaying(true);
        }
      }
    };

    const handleVideoEnd = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setProgress((videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100);
      }
    };

    return (
      <div
        className="w-full h-full relative overflow-hidden group flex items-center justify-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleVideoClick}
      >
        <video
          ref={videoRef}
          src={node.data?.metadata?.videoUrl as string}
          className={`w-full h-full ${inModal ? 'object-contain' : 'object-cover'}`}
          muted
          preload="metadata"
          onEnded={handleVideoEnd}
          onTimeUpdate={handleTimeUpdate}
        />
        {/* Play button overlay - only show when not playing */}
        {!isPlaying && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            onClick={handleVideoClick}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                isHovered ? 'scale-110' : ''
              }`}
              style={{
                borderRadius: '80px',
                backgroundColor: 'var(--refly-bg-float-z3)',
              }}
            >
              <Play color="var(--refly-text-StaticWhite)" className="w-4 h-4 ml-0.5" />
            </div>
          </div>
        )}
        {/* Progress bar - only show when playing */}
        {isPlaying && (
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--refly-modal-mask)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: 'var(--refly-text-StaticWhite)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        )}
        {/* View overlay moved to parent */}
      </div>
    );
  },
);

VideoPreview.displayName = 'VideoPreview';

// Audio preview component with independent state
const AudioPreview = memo(
  ({ node }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Register stop function with media manager
    useEffect(() => {
      const stopAudio = () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
          setProgress(0);
        }
      };

      const unregister = mediaManager.register(stopAudio);
      return unregister;
    }, []);

    const handleAudioClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (audioRef.current) {
        if (isPlaying) {
          // If playing, just pause it
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          // If not playing, stop all other media first, then play this one
          mediaManager.stopAll();
          audioRef.current.play().catch((error) => {
            console.error('Error playing audio:', error);
          });
          setIsPlaying(true);
        }
      }
    };

    const handleAudioEnd = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const handleAudioTimeUpdate = () => {
      if (audioRef.current) {
        const progressValue = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(progressValue);
      }
    };

    return (
      <div
        className="w-full h-full relative overflow-hidden cursor-pointer"
        onClick={handleAudioClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          backgroundColor: 'var(--refly-Colorful-red-light)',
        }}
      >
        {/* Fixed background pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="w-full h-full flex items-center justify-center">
            <img src={AudioBgSvg} alt="Audio background" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={node.data?.metadata?.audioUrl as string}
          onEnded={handleAudioEnd}
          onTimeUpdate={handleAudioTimeUpdate}
        >
          <track kind="captions" />
        </audio>

        {/* Play button overlay - only show when not playing */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                isHovered ? 'scale-110' : ''
              }`}
              style={{
                borderRadius: '80px',
                backgroundColor: 'var(--refly-bg-float-z3)',
              }}
            >
              <Play color="var(--refly-text-StaticWhite)" className="w-4 h-4 ml-0.5" />
            </div>
          </div>
        )}
        {/* Progress bar - only show when playing */}
        {isPlaying && (
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--refly-modal-mask)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: 'var(--refly-text-StaticWhite)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        )}
        {/* View overlay moved to parent */}
      </div>
    );
  },
);

AudioPreview.displayName = 'AudioPreview';

// Default preview component without view overlay (handled by parent)
const DefaultPreview = memo(
  ({ node }: { node: CanvasNode; onViewClick?: (nodeId: string) => void }) => {
    const handleClick = useCallback(() => {
      // Stop all playing media when clicking on default preview
      mediaManager.stopAll();
    }, []);

    return (
      <div className="w-full h-full relative overflow-y-auto" onClick={handleClick}>
        <PreviewComponent node={node} purePreview={true} />
      </div>
    );
  },
);

DefaultPreview.displayName = 'DefaultPreview';

// Individual result item preview component
export const ResultItemPreview = memo(
  ({ node, inModal = false }: { node: CanvasNode; inModal?: boolean }) => {
    const [wideModeOpen, setWideModeOpen] = useState(false);
    const inheritedUsePublicFileUrl = usePublicFileUrlContext();
    const [isHovered, setIsHovered] = useState(false);

    // Construct DriveFile from node metadata if fileId exists
    const driveFile = useMemo<DriveFile | null>(() => {
      const fileId = node.data?.metadata?.fileId as string | undefined;
      if (!fileId) {
        return null;
      }

      return {
        fileId,
        canvasId: (node.data?.metadata?.canvasId as string | undefined) ?? '',
        name: node.data?.title ?? '',
        type: (node.data?.metadata?.type as string | undefined) ?? '',
        category: node.type as DriveFile['category'],
        publicURL: node.data?.metadata?.publicURL as string | undefined,
        source: node.data?.metadata?.source as DriveFile['source'],
        scope: node.data?.metadata?.scope as DriveFile['scope'],
        size: node.data?.metadata?.size as number | undefined,
        summary: node.data?.metadata?.summary as string | undefined,
        variableId: node.data?.metadata?.variableId as string | undefined,
        resultId: node.data?.metadata?.resultId as string | undefined,
        resultVersion: node.data?.metadata?.resultVersion as number | undefined,
        content: node.data?.metadata?.content as string | undefined,
        createdAt: node.data?.metadata?.createdAt as string | undefined,
        updatedAt: node.data?.metadata?.updatedAt as string | undefined,
      };
    }, [node.data?.metadata, node.data?.title, node.type]);

    let content: JSX.Element;
    // Priority 1: Use FilePreview for Drive files (when fileId exists)
    // This handles all file types including document, image, video, audio, etc.
    if (driveFile) {
      content = <FilePreview file={driveFile} source={inModal ? 'preview' : 'card'} />;
    } else if (node.type === 'image' && node.data?.metadata?.imageUrl) {
      // Fallback to existing image preview for backward compatibility
      content = <ImagePreview node={node} inModal={inModal} />;
    } else if (node.type === 'video' && node.data?.metadata?.videoUrl) {
      // Fallback to existing video preview for backward compatibility
      content = <VideoPreview node={node} inModal={inModal} />;
    } else if (node.type === 'audio' && node.data?.metadata?.audioUrl) {
      // Fallback to existing audio preview for backward compatibility
      content = <AudioPreview node={node} />;
    } else if (node.type === 'codeArtifact') {
      // Use artifact renderer for knowledge base code artifacts (when no fileId)
      content = (
        <WithSuspense>
          <LazyCodeArtifactRenderer
            isFullscreen
            node={{ ...node, nodeData: node.data, nodeType: node.type } as unknown as NodeRelation}
          />
        </WithSuspense>
      );
    } else if (node.type === 'document') {
      // Use document renderer for knowledge base documents (when no fileId)
      // Document renderer requires entityId to be a docId for knowledge base documents
      content = (
        <WithSuspense>
          <LazyDocumentRenderer
            isFullscreen
            node={{ ...node, nodeData: node.data, nodeType: node.type } as unknown as NodeRelation}
          />
        </WithSuspense>
      );
    } else {
      content = <DefaultPreview node={node} />;
    }

    // Stop all media when modal opens or closes
    useEffect(() => {
      // Stop all playing media when modal state changes (both open and close)
      mediaManager.stopAll();
    }, [wideModeOpen]);

    // 宽屏弹窗开关
    const handleWideModeOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      logEvent('view_template_generate_result', null, {});
      // Stop all playing media when opening modal
      mediaManager.stopAll();
      setWideModeOpen(true);
    };

    const handleWideModeClose = () => {
      // Stop all playing media when closing modal
      mediaManager.stopAll();
      setWideModeOpen(false);
    };

    return (
      <>
        <Modal
          open={wideModeOpen}
          footer={null}
          onCancel={handleWideModeClose}
          width="85%"
          style={{ top: 20 }}
          modalRender={(modalNode) => (
            <PublicFileUrlProvider value={inheritedUsePublicFileUrl}>
              {modalNode}
            </PublicFileUrlProvider>
          )}
          styles={{
            body: {
              maxHeight: 'calc(var(--screen-height) - 100px)',
              padding: 0,
              overflow: 'hidden',
            },
            mask: {
              background: 'rgba(0, 0, 0, 0.65)',
            },
          }}
          className="wide-mode-modal"
          closeIcon={<CloseCircleOutlined className="text-gray-500 hover:text-red-500" />}
        >
          <div className="bg-white h-full w-full flex flex-col rounded-lg overflow-hidden dark:bg-gray-900">
            <div className="flex-1 overflow-auto">
              {/* 只使用主 node 的结构，避免 CanvasNodeData 非法属性 */}
              <div style={{ height: 'calc(var(--screen-height) - 160px)' }}>
                <NodeRenderer
                  node={{
                    relationId: node.id || 'unknown',
                    nodeId: node.id || 'unknown',
                    nodeType: node.type || 'unknown',
                    entityId: node.data?.entityId ?? '',
                    orderIndex: 0,
                    nodeData: node.data ?? {},
                  }}
                  isFullscreen={false}
                  isModal={true}
                  isMinimap={false}
                  isFocused={true}
                  inModal
                />
              </div>
            </div>
          </div>
        </Modal>
        <div
          className="w-full h-full relative cursor-pointer position-relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {content}
          {/* {needsTransparentOverlay ? <div className="absolute inset-0 bg-transparent" /> : null} */}
          {isHovered && !inModal && (
            <div
              onClick={handleWideModeOpen}
              className="absolute z-50 flex items-center justify-center transition-opacity duration-200 cursor-pointer"
              style={{
                right: '14px',
                bottom: '14px',
                width: 'min(56px, 20%)',
                height: 'min(44px, 20%)',
              }}
            >
              <img
                src={ViewSvg}
                alt="View"
                className="w-full h-full object-contain"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            </div>
          )}
        </div>
      </>
    );
  },
);
