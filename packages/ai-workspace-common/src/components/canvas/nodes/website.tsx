import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNode, CanvasNodeData, WebsiteNodeMeta } from '@refly/canvas-common';
import { WebsiteNodeProps } from './shared/types';
import { CustomHandle } from './shared/custom-handle';
import { getNodeCommonStyles } from './shared/styles';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { FiCode, FiEye, FiExternalLink, FiCopy } from 'react-icons/fi';
import { Button, Form, Input, message, Tooltip } from 'antd';
import {
  nodeActionEmitter,
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { NodeHeader } from './shared/node-header';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { IContextItem } from '@refly/common-types';
import { genSkillID } from '@refly/utils/id';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { NodeActionButtons } from './shared/node-action-buttons';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';

const NODE_WIDTH = 320;
const NODE_EDIT_CONFIG = { width: 320, height: 288 };
const NODE_PREVIEW_CONFIG = { width: 800, height: 600 };

/**
 * Website node content component that displays either a form for URL input or an iframe preview
 */
const NodeContent = memo(
  ({ data, readonly }: { data: CanvasNodeData<WebsiteNodeMeta>; readonly: boolean }) => {
    const { url = '', viewMode = 'form' } = data?.metadata ?? {};
    const [isEditing, setIsEditing] = useState(viewMode === 'form' || !url);
    const { t } = useTranslation();
    const setNodeDataByEntity = useSetNodeDataByEntity();
    const formRef = useRef<any>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Update editing state when metadata changes
    useEffect(() => {
      const shouldBeEditing = data?.metadata?.viewMode === 'form' || !data?.metadata?.url;
      if (isEditing !== shouldBeEditing) {
        setIsEditing(shouldBeEditing);
      }
    }, [data?.metadata?.url, data?.metadata?.viewMode, isEditing]);

    // Initialize form with current URL when entering edit mode
    useEffect(() => {
      if (isEditing && formRef.current && url) {
        formRef.current.setFieldsValue({ url });
      }
    }, [isEditing, url]);

    // Handle form submission to save URL
    const handleSubmit = useCallback(
      (values: { url: string }) => {
        if (!values?.url) {
          message.error(t('canvas.nodes.website.urlRequired', 'URL is required'));
          return;
        }

        // Add https:// if missing
        let formattedUrl = values.url;
        if (!/^https?:\/\//i.test(formattedUrl)) {
          formattedUrl = `https://${formattedUrl}`;
        }

        setNodeDataByEntity(
          {
            type: 'website',
            entityId: data.entityId,
          },
          {
            metadata: {
              ...data.metadata,
              url: formattedUrl,
              viewMode: 'preview',
            },
          },
        );
        setIsEditing(false);
      },
      [data.entityId, data.metadata, setNodeDataByEntity, t],
    );

    // Toggle between form and preview modes
    const toggleMode = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsEditing((prev) => !prev);
        setNodeDataByEntity(
          {
            type: 'website',
            entityId: data.entityId,
          },
          {
            metadata: {
              ...data.metadata,
              viewMode: isEditing ? 'preview' : 'form',
            },
          },
        );
      },
      [data.entityId, data.metadata, isEditing, setNodeDataByEntity],
    );

    // Open website in a new tab
    const handleOpenInNewTab = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
      [url],
    );

    // Handle copy URL to clipboard
    const handleCopyUrl = useCallback(
      async (event: React.MouseEvent) => {
        event.stopPropagation();
        if (url) {
          try {
            await navigator.clipboard.writeText(url);
            message.success(t('canvas.nodes.website.urlCopied', 'URL copied to clipboard'));
          } catch (err: any) {
            console.error(err);
            message.error(t('canvas.nodes.website.copyFailed', 'Failed to copy URL'));
          }
        }
      },
      [url, t],
    );

    // If no URL or in form mode, show the form
    if (isEditing) {
      return (
        <div className="p-4 w-full h-full flex flex-col">
          <div className="flex justify-between mb-4">
            <div className="text-lg font-medium">
              {t('canvas.nodes.website.addWebsite', 'Add Website')}
            </div>
            {url && (
              <Button
                type="text"
                icon={<FiEye />}
                onClick={toggleMode}
                className="flex items-center"
              >
                {t('canvas.nodes.website.preview', 'Preview')}
              </Button>
            )}
          </div>
          <Form
            ref={formRef}
            layout="vertical"
            initialValues={{ url }}
            onFinish={handleSubmit}
            className="flex-1"
          >
            <Form.Item
              name="url"
              label={t('canvas.nodes.website.websiteUrl', 'Website URL')}
              rules={[
                {
                  required: true,
                  message: t('canvas.nodes.website.urlRequired', 'Please enter a website URL'),
                },
              ]}
            >
              <Input placeholder="https://example.com" className="w-full" disabled={readonly} />
            </Form.Item>
            <Form.Item className="mt-4">
              <Button type="primary" htmlType="submit" className="w-full" disabled={readonly}>
                {t('canvas.nodes.website.save', 'Save and View Website')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      );
    }

    // Show the website in an iframe
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex justify-between items-center p-2 border-b border-gray-200">
          <div className="text-sm font-medium truncate flex-1">{url}</div>
          <div className="flex items-center">
            <Tooltip title={t('canvas.nodes.website.copyUrl', 'Copy URL')}>
              <Button type="text" icon={<FiCopy />} onClick={handleCopyUrl} className="mr-1" />
            </Tooltip>
            <Tooltip title={t('canvas.nodes.website.openInNewTab', 'Open in new tab')}>
              <Button
                type="text"
                icon={<FiExternalLink />}
                onClick={handleOpenInNewTab}
                className="mr-1"
              />
            </Tooltip>
            <Button
              type="text"
              icon={<FiCode />}
              onClick={toggleMode}
              className="flex items-center"
              disabled={readonly}
            >
              {t('canvas.nodes.website.edit', 'Edit')}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            src={url}
            title={data.title}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            allow="fullscreen"
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={(e) => {
              try {
                // Try to access iframe content to mute any audio/video elements
                const iframe = e.target as HTMLIFrameElement;
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

                if (iframeDoc) {
                  // Function to handle media elements
                  const handleMediaElement = (element: HTMLMediaElement) => {
                    element.muted = true;
                    element.autoplay = false;
                    element.setAttribute('autoplay', 'false');
                    element.setAttribute('preload', 'none');

                    // Remove any existing event listeners
                    const elementClone = element.cloneNode(true) as HTMLMediaElement;
                    element.parentNode?.replaceChild(elementClone, element);

                    // Prevent play attempts
                    elementClone.addEventListener(
                      'play',
                      (e) => {
                        if (elementClone.muted === false) {
                          elementClone.muted = true;
                          e.preventDefault();
                          elementClone.pause();
                        }
                      },
                      true,
                    );
                  };

                  // Handle existing media elements
                  const mediaElements = iframeDoc.querySelectorAll('video, audio, iframe');
                  for (const element of Array.from(mediaElements)) {
                    if (element instanceof HTMLMediaElement) {
                      handleMediaElement(element);
                    } else if (element instanceof HTMLIFrameElement) {
                      // Handle nested iframes
                      element.setAttribute('allow', 'fullscreen');
                      element.setAttribute('autoplay', 'false');
                    }
                  }

                  // Create observer to handle dynamically added elements
                  const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                      for (const node of Array.from(mutation.addedNodes)) {
                        if (node instanceof HTMLElement) {
                          // Handle newly added media elements
                          const newMediaElements = node.querySelectorAll('video, audio, iframe');
                          for (const element of Array.from(newMediaElements)) {
                            if (element instanceof HTMLMediaElement) {
                              handleMediaElement(element);
                            } else if (element instanceof HTMLIFrameElement) {
                              element.setAttribute('allow', 'fullscreen');
                              element.setAttribute('autoplay', 'false');
                            }
                          }

                          // Also check if the node itself is a media element
                          if (node instanceof HTMLMediaElement) {
                            handleMediaElement(node);
                          } else if (node instanceof HTMLIFrameElement) {
                            node.setAttribute('allow', 'fullscreen');
                            node.setAttribute('autoplay', 'false');
                          }
                        }
                      }
                    }
                  });

                  // Start observing
                  observer.observe(iframeDoc.body, {
                    childList: true,
                    subtree: true,
                  });

                  // Add strict CSP
                  const meta = iframeDoc.createElement('meta');
                  meta.setAttribute('http-equiv', 'Content-Security-Policy');
                  meta.setAttribute(
                    'content',
                    "media-src 'none'; autoplay 'none'; camera 'none'; microphone 'none'",
                  );
                  iframeDoc.head?.insertBefore(meta, iframeDoc.head.firstChild);

                  // Add CSS to prevent autoplay and ensure muted state
                  const style = iframeDoc.createElement('style');
                  style.textContent = `
                    video, audio, iframe {
                      autoplay: false !important;
                      muted: true !important;
                    }
                    video[autoplay], audio[autoplay], iframe[autoplay] {
                      autoplay: false !important;
                    }
                    video:not([muted]), audio:not([muted]) {
                      muted: true !important;
                    }
                    /* Bilibili specific */
                    .bilibili-player-video {
                      pointer-events: none !important;
                    }
                    .bilibili-player-video-control {
                      pointer-events: auto !important;
                    }
                  `;
                  iframeDoc.head?.appendChild(style);

                  // Clean up observer when iframe is unloaded
                  return () => observer.disconnect();
                }
              } catch {
                // Ignore cross-origin errors
                console.debug('Cannot access iframe content due to same-origin policy');
              }
            }}
          />
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    const prevUrl = prevProps.data?.metadata?.url;
    const nextUrl = nextProps.data?.metadata?.url;
    const prevViewMode = prevProps.data?.metadata?.viewMode;
    const nextViewMode = nextProps.data?.metadata?.viewMode;
    const prevReadonly = prevProps.readonly;
    const nextReadonly = nextProps.readonly;

    return prevUrl === nextUrl && prevViewMode === nextViewMode && prevReadonly === nextReadonly;
  },
);

NodeContent.displayName = 'NodeContent';

/**
 * Main WebsiteNode component for displaying websites in the canvas
 */
export const WebsiteNode = memo(
  ({
    data,
    id,
    selected,
    isPreview = false,
    hideHandles = false,
    onNodeClick,
  }: WebsiteNodeProps) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);

    const { addToContext } = useAddToContext();
    const { deleteNode } = useDeleteNode();
    const { getNode, getEdges } = useReactFlow();
    const { addNode } = useAddNode();
    const updateNodeTitle = useUpdateNodeTitle();
    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();
    const { setNodeStyle } = useNodeData();

    const { viewMode = 'form' } = data?.metadata ?? {};
    const isEditing = viewMode === 'form' || !data?.metadata?.url;
    const nodeStyle = useMemo(
      () => (isEditing ? NODE_EDIT_CONFIG : NODE_PREVIEW_CONFIG),
      [isEditing],
    );

    // Hover effect
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

    const node = getNode(id);

    const { readonly } = useCanvasContext();

    // Check if node has any connections
    const edges = getEdges();
    const isTargetConnected = edges?.some((edge) => edge.target === id);
    const isSourceConnected = edges?.some((edge) => edge.source === id);

    // Handle mouse events
    const handleMouseEnter = useCallback(() => {
      if (!isHovered) {
        setIsHovered(true);
        onHoverStart();
      }
    }, [isHovered, onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      if (isHovered) {
        setIsHovered(false);
        onHoverEnd();
      }
    }, [isHovered, onHoverEnd]);

    // Handle adding to context
    const handleAddToContext = useCallback(() => {
      addToContext({
        type: 'website',
        title: data.title || t('canvas.nodes.website.defaultTitle', 'Website'),
        entityId: data.entityId,
        metadata: {
          ...data.metadata,
        },
      });
    }, [addToContext, data.metadata, data.title, data.entityId, t]);

    // Handle deletion
    const handleDelete = useCallback(() => {
      if (id) {
        deleteNode({
          id,
          type: 'website',
          data,
          position: { x: 0, y: 0 },
        } as CanvasNode);
      }
    }, [id, data, deleteNode]);

    // Add Ask AI functionality
    const handleAskAI = useCallback(
      (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        const url = data?.metadata?.url;
        if (!url) return;

        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'website' },
          event?.dragCreateInfo,
        );

        addNode(
          {
            type: 'skill',
            data: {
              title: 'Skill',
              entityId: genSkillID(),
              metadata: {
                contextItems: [
                  {
                    type: 'website',
                    title: data?.title || t('canvas.nodes.website.defaultTitle', 'Website'),
                    entityId: data.entityId,
                    metadata: data.metadata,
                  },
                ] as IContextItem[],
              },
            },
            position,
          },
          connectTo,
          false,
          true,
        );
      },
      [data, addNode, t, getConnectionInfo],
    );

    const updateTitle = (newTitle: string) => {
      if (newTitle === node.data?.title) {
        return;
      }
      updateNodeTitle(newTitle, data.entityId, id, 'website');
    };

    // Set node style on mount
    useEffect(() => {
      setNodeStyle(id, nodeStyle);
    }, [id, setNodeStyle, nodeStyle]);

    // Add event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeDelete = () => handleDelete();
      const handleNodeAskAI = (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleAskAI(event);

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [id, handleAddToContext, handleDelete, handleAskAI]);

    return (
      <div
        data-cy="website-node"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="rounded-2xl relative"
        style={isPreview ? { width: NODE_WIDTH, height: 200 } : nodeStyle}
        onClick={onNodeClick}
      >
        {!isPreview && !readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="website"
            isNodeHovered={isHovered}
            isSelected={selected}
          />
        )}

        {!isPreview && !hideHandles && (
          <>
            <CustomHandle
              id={`${id}-target`}
              nodeId={id}
              type="target"
              position={Position.Left}
              isConnected={isTargetConnected}
              isNodeHovered={isHovered}
              nodeType="website"
            />
            <CustomHandle
              id={`${id}-source`}
              nodeId={id}
              type="source"
              position={Position.Right}
              isConnected={isSourceConnected}
              isNodeHovered={isHovered}
              nodeType="website"
            />
          </>
        )}

        <div
          className={`h-full flex flex-col relative z-1 p-4 box-border ${getNodeCommonStyles({ selected, isHovered })}`}
        >
          <NodeHeader
            canEdit={!readonly}
            fixedTitle={t('canvas.nodeTypes.website')}
            title={data?.title}
            type="website"
            updateTitle={updateTitle}
          />
          <div className="relative flex-grow overflow-y-auto pr-2 -mr-2">
            <div
              style={{
                height: '100%',
                overflowY: 'auto',
              }}
            >
              <NodeContent data={data} readonly={readonly} />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

WebsiteNode.displayName = 'WebsiteNode';
