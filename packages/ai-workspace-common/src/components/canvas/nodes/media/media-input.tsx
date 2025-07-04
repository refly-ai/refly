import React, { memo, useCallback, useMemo, useState } from 'react';
import { Input, Button, Dropdown } from 'antd';
import { SendOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { IconImage } from '@refly-packages/ai-workspace-common/components/common/icon';
import { HiOutlineFilm, HiOutlineSpeakerWave } from 'react-icons/hi2';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genMediaSkillResponseID } from '@refly/utils/id';
import { useReactFlow } from '@xyflow/react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CanvasNodeFilter } from '@refly/canvas-common';
import { cn } from '@refly/utils/cn';
export type MediaType = 'image' | 'video' | 'audio';

const modelsByType = {
  image: [
    'black-forest-labs/flux-schnell',
    'black-forest-labs/flux-dev',
    'black-forest-labs/flux-pro',
  ],
  video: [
    'bytedance/seedance-1-pro',
    'bytedance/seedance-1-lite',
    'minimax/video-01',
    'kwaivgi/kling-v2.1',
    'google/veo-3',
    'luma/ray-flash-2-540p',
  ],
  audio: ['resemble-ai/chatterbox', 'google/lyria-2'],
};

const { TextArea } = Input;

interface MediaChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (value: string) => void;
  mediaType: MediaType;
  setMediaType: (type: MediaType) => void;
  nodeId: string;
  onSend?: () => void;
}

const MediaChatInput = memo(
  ({ readonly, query, setQuery, mediaType, setMediaType, nodeId, onSend }: MediaChatInputProps) => {
    const { t } = useTranslation();
    const { addNode } = useAddNode();
    const { getNode } = useReactFlow();
    const [loading, setLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string>('');

    const mediaOptions = useMemo(() => {
      return [
        {
          value: 'image',
          label: t('canvas.nodes.mediaSkill.image', 'Image'),
          icon: IconImage,
        },
        {
          value: 'video',
          label: t('canvas.nodes.mediaSkill.video', 'Video'),
          icon: HiOutlineFilm,
        },
        {
          value: 'audio',
          label: t('canvas.nodes.mediaSkill.audio', 'Audio'),
          icon: HiOutlineSpeakerWave,
        },
      ];
    }, [t]);

    const availableModels = useMemo(() => {
      return modelsByType[mediaType] || [];
    }, [mediaType]);

    // Set default model when mediaType changes
    React.useEffect(() => {
      if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
        setSelectedModel(availableModels[0]);
      }
    }, [availableModels, selectedModel]);

    const modelDropdownItems = useMemo(() => {
      return availableModels.map((model) => ({
        key: model,
        label: (
          <div className="flex items-center">
            <span className="text-sm">{model}</span>
          </div>
        ),
        onClick: () => setSelectedModel(model),
      }));
    }, [availableModels]);

    const dropdownItems = useMemo(() => {
      return mediaOptions.map((option) => ({
        key: option.value,
        label: (
          <div className="flex items-center gap-2">
            <option.icon className="w-4 h-4" />
            <span className="text-sm">{option.label}</span>
          </div>
        ),
        onClick: () => setMediaType(option.value as MediaType),
      }));
    }, [mediaOptions, setMediaType]);

    const currentMediaOption = useMemo(() => {
      return mediaOptions.find((option) => option.value === mediaType);
    }, [mediaOptions, mediaType]);

    const getPlaceholder = useCallback(() => {
      switch (mediaType) {
        case 'image':
          return t(
            'canvas.nodes.mediaSkill.imagePlaceholder',
            'Describe the image you want to generate...',
          );
        case 'video':
          return t(
            'canvas.nodes.mediaSkill.videoPlaceholder',
            'Describe the video you want to generate...',
          );
        case 'audio':
          return t(
            'canvas.nodes.mediaSkill.audioPlaceholder',
            'Describe the audio you want to generate...',
          );
        default:
          return t(
            'canvas.nodes.mediaSkill.defaultPlaceholder',
            'Describe what you want to generate...',
          );
      }
    }, [mediaType, t]);

    const handleGenerateMedia = useCallback(
      async (mediaType: MediaType, query: string) => {
        if (loading) return;
        setLoading(true);

        try {
          const { data } = await getClient().generateMedia({
            body: {
              prompt: query,
              mediaType,
              provider: 'replicate',
              model: selectedModel,
            },
          });

          if (data?.success && data?.resultId) {
            // Create MediaSkillResponse node
            const resultId = data.resultId;
            const entityId = genMediaSkillResponseID();

            const newNode = {
              type: 'mediaSkillResponse' as const,
              data: {
                title: query,
                entityId,
                metadata: {
                  status: 'waiting' as const,
                  mediaType,
                  prompt: query,
                  model: selectedModel,
                  resultId,
                },
              },
            };

            const currentNode = getNode(nodeId);
            const connectedTo: CanvasNodeFilter[] = currentNode
              ? [
                  {
                    type: 'mediaSkill',
                    entityId: currentNode.data?.entityId as string,
                    handleType: 'source',
                  },
                ]
              : [];

            addNode(newNode, connectedTo, false, true);
          } else {
            console.error('Failed to generate media', data);
          }
        } catch (error) {
          console.error('Failed to generate media', error);
        } finally {
          setLoading(false);
        }
      },
      [loading, selectedModel, getNode, nodeId, addNode],
    );

    const handleSend = useCallback(() => {
      if (!query?.trim()) return;

      handleGenerateMedia(mediaType, query);

      // Call optional onSend callback
      onSend?.();
    }, [query, mediaType, handleGenerateMedia, onSend]);

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
          style={{ paddingLeft: 0, paddingRight: 0, height: '100%' }}
          className={cn(
            'flex-1 flex-shrink-0 !m-0 bg-transparent outline-none box-border border-none focus:outline-none focus:shadow-none focus:border-none focus:ring-0',
            readonly && 'cursor-not-allowed !text-black !bg-transparent',
            'dark:hover:bg-transparent dark:hover:!bg-none dark:focus:bg-transparent dark:active:bg-transparent dark:bg-transparent dark:!bg-transparent',
          )}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={getPlaceholder()}
          disabled={readonly}
          autoSize={{ minRows: 2, maxRows: 6 }}
          onKeyDown={handleKeyDown}
        />

        {!readonly && (
          <div className="flex justify-between items-center gap-2 mt-2">
            {/* Model Selector */}
            <Dropdown
              menu={{ items: modelDropdownItems }}
              disabled={readonly || availableModels.length === 0}
              placement="bottomLeft"
            >
              <Button size="small" className="flex items-center gap-1 border-none shadow-none px-0">
                <span className="text-sm">{selectedModel || 'Select Model'}</span>
                <DownOutlined className="w-3 h-3" />
              </Button>
            </Dropdown>

            {/* Media Type Selector */}
            <div className="flex items-center gap-2">
              <Dropdown menu={{ items: dropdownItems }} disabled={readonly} placement="bottomRight">
                <Button size="small" className="flex items-center gap-1">
                  {currentMediaOption && <currentMediaOption.icon className="w-4 h-4" />}
                  <span className="text-sm">{currentMediaOption?.label}</span>
                  <DownOutlined className="w-3 h-3" />
                </Button>
              </Dropdown>

              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={loading || !query?.trim()}
                loading={loading}
              >
                {loading ? t('common.generating', 'Generating...') : t('common.send', 'Send')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

MediaChatInput.displayName = 'MediaChatInput';

export { MediaChatInput };
