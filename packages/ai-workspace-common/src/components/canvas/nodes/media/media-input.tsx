import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Input, Button } from 'antd';
import { Send } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { cn } from '@refly/utils/cn';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { ChatModeSelector } from '@refly-packages/ai-workspace-common/components/canvas/front-page/chat-mode-selector';
import { useChatStoreShallow } from '@refly/stores';
import { useFrontPageStoreShallow } from '@refly/stores';
import { MediaModelSelector } from './media-model-selector';
import { ProviderItem } from '@refly/openapi-schema';
import { type MediaQueryData } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';

const { TextArea } = Input;

interface MediaChatInputProps {
  showChatModeSelector?: boolean;
  readonly: boolean;
  query: string;
  setQuery: (value: string) => void;
  nodeId?: string;
  onSend?: () => void;
  defaultModel?: ProviderItem | null;
  onModelChange?: (model: ProviderItem | null) => void;
  size?: 'small' | 'medium';
}

const MediaChatInput = memo(
  ({
    readonly,
    query,
    setQuery,
    nodeId,
    onSend,
    showChatModeSelector,
    defaultModel,
    onModelChange,
    size = 'medium',
  }: MediaChatInputProps) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const { projectId, isCanvasOpen, canvasId } = useGetProjectCanvasId();
    const { debouncedCreateCanvas } = useCreateCanvas({
      projectId,
      afterCreateSuccess: () => {
        // Canvas creation is handled by the hook itself
      },
    });

    const {
      chatMode,
      setChatMode,
      mediaSelectedModel: selectedModel,
      setMediaSelectedModel: setSelectedModel,
      mediaModelList,
      mediaModelListLoading,
    } = useChatStoreShallow((state) => ({
      chatMode: state.chatMode,
      setChatMode: state.setChatMode,
      mediaSelectedModel: state.mediaSelectedModel,
      setMediaSelectedModel: state.setMediaSelectedModel,
      mediaModelList: state.mediaModelList,
      mediaModelListLoading: state.mediaModelListLoading,
    }));

    // Update parent when model changes
    const handleModelChange = useCallback(
      (model: ProviderItem | null) => {
        setSelectedModel(model);
        onModelChange?.(model);
      },
      [onModelChange, setSelectedModel],
    );

    // Get current media type based on selected model capabilities
    const currentMediaType = useMemo(() => {
      if (!selectedModel?.config) return 'image';

      const config = selectedModel.config as any;
      if (!config?.capabilities) return 'image';

      if (config.capabilities.image) return 'image';
      if (config.capabilities.video) return 'video';
      if (config.capabilities.audio) return 'audio';

      return 'image'; // Default fallback
    }, [selectedModel]);

    useEffect(() => {
      if (!selectedModel && mediaModelList?.length > 0) {
        // If defaultModel is provided and exists in mediaModelList, use it
        if (defaultModel && mediaModelList.some((m) => m.itemId === defaultModel.itemId)) {
          setSelectedModel(defaultModel);
        } else {
          // Otherwise use the first available model
          setSelectedModel(mediaModelList[0]);
        }
      }
    }, [defaultModel, mediaModelList, selectedModel]);

    const { setMediaQueryData } = useFrontPageStoreShallow((state) => ({
      setMediaQueryData: state.setMediaQueryData,
    }));

    const handleGenerateMedia = useCallback(
      async (query: string) => {
        if (loading) return;
        setLoading(true);

        try {
          // Check if there's no canvas open
          if (!isCanvasOpen) {
            // Create a new canvas first
            const mediaQueryData: MediaQueryData = {
              mediaType: currentMediaType,
              query,
              modelInfo: {
                name: selectedModel?.config?.modelId || '',
                label: selectedModel?.name || '',
                provider: selectedModel?.provider?.name || '',
                contextLimit: 0,
                maxOutput: 0,
              },
              providerItemId: selectedModel?.itemId ?? '',
            };
            setMediaQueryData(mediaQueryData);
            debouncedCreateCanvas('front-page', { isMediaGeneration: true });
          } else {
            nodeOperationsEmitter.emit('generateMedia', {
              providerItemId: selectedModel?.itemId ?? '',
              targetType: 'canvas',
              targetId: canvasId ?? '',
              mediaType: currentMediaType,
              query,
              modelInfo: {
                name: selectedModel?.config?.modelId || '',
                label: selectedModel?.name || '',
                provider: selectedModel?.provider?.name || '',
                contextLimit: 0,
                maxOutput: 0,
              },
              nodeId: nodeId || '',
            });
          }
        } catch (error) {
          console.error('Failed to emit generateMedia event', error);
          setLoading(false);
        }
      },
      [
        loading,
        selectedModel,
        nodeId,
        canvasId,
        isCanvasOpen,
        debouncedCreateCanvas,
        currentMediaType,
      ],
    );

    // Listen for media generation completion events
    useEffect(() => {
      const handleMediaGenerationComplete = ({
        nodeId: completedNodeId,
        success,
        error,
      }: { nodeId: string; success: boolean; error?: string }) => {
        // Stop loading if this is the node we're waiting for, or if we don't have a specific nodeId (front-page case)
        if ((nodeId && completedNodeId === nodeId) || (!nodeId && !isCanvasOpen)) {
          setLoading(false);

          // Show error message if generation failed
          if (!success && error) {
            console.error('Media generation failed:', error);
          }
        }
      };

      nodeOperationsEmitter.on('mediaGenerationComplete', handleMediaGenerationComplete);

      return () => {
        nodeOperationsEmitter.off('mediaGenerationComplete', handleMediaGenerationComplete);
      };
    }, [nodeId, isCanvasOpen]);

    const handleSend = useCallback(() => {
      if (!query?.trim()) return;

      handleGenerateMedia(query);

      // Call optional onSend callback
      onSend?.();
    }, [query, handleGenerateMedia, onSend]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        // Handle Enter key
        if (e.key === 'Enter') {
          // Shift + Enter creates a new line
          if (e.shiftKey) {
            return;
          }

          // Ctrl/Meta + Enter or plain Enter sends message
          if (e.ctrlKey || e.metaKey || !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }
      },
      [readonly, handleSend],
    );

    return (
      <div>
        <TextArea
          style={{ paddingLeft: 0, paddingRight: 0, paddingTop: '4px', paddingBottom: '4px' }}
          className={cn(
            'flex-1 flex-shrink-0 !m-0 bg-transparent outline-none box-border border-none focus:outline-none focus:shadow-none focus:border-none focus:ring-0',
            readonly && 'cursor-not-allowed !text-black !bg-transparent',
            'dark:hover:bg-transparent dark:hover:!bg-none dark:focus:bg-transparent dark:active:bg-transparent dark:!bg-transparent',
            isFocused ? 'nodrag nopan nowheel cursor-text' : '!cursor-pointer',
          )}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(
            `canvas.nodes.mediaSkill.${currentMediaType}Placeholder`,
            'Describe what you want to generate...',
          )}
          disabled={readonly}
          autoSize={{ minRows: 2, maxRows: 6 }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {!readonly && (
          <div className="flex justify-between items-center gap-2 mt-2">
            <div className="flex items-center gap-2">
              {/* Chat Mode Selector */}
              {showChatModeSelector && (
                <ChatModeSelector chatMode={chatMode} setChatMode={setChatMode} />
              )}

              {/* Media Model Selector */}
              <MediaModelSelector
                size={size}
                model={selectedModel}
                setModel={handleModelChange}
                readonly={readonly}
                defaultModel={defaultModel}
                mediaModelList={mediaModelList}
                loading={mediaModelListLoading}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="flex items-center !h-9 !w-9 rounded-full border-none"
                size="small"
                type="primary"
                icon={<Send size={20} color="white" />}
                onClick={() => {
                  logEvent('canvas::node_execute', Date.now(), {
                    node_type: 'mediaGenerate',
                    model_name: selectedModel?.config?.modelId,
                    used_knowledge_base: false,
                    used_mcp: false,
                  });
                  handleSend();
                }}
                disabled={loading || !query?.trim()}
                loading={loading}
              />
            </div>
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.defaultModel === nextProps.defaultModel &&
      prevProps.readonly === nextProps.readonly &&
      prevProps.query === nextProps.query &&
      prevProps.showChatModeSelector === nextProps.showChatModeSelector &&
      prevProps.onModelChange === nextProps.onModelChange &&
      prevProps.onSend === nextProps.onSend &&
      prevProps.nodeId === nextProps.nodeId
    );
  },
);

MediaChatInput.displayName = 'MediaChatInput';

export { MediaChatInput };
