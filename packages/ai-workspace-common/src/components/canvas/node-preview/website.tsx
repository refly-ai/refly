import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { WebsiteNodeMeta } from '@refly/canvas-common';
import { Button, Form, Input, message, Tooltip } from 'antd';
import { FiCode, FiEye, FiExternalLink, FiCopy } from 'react-icons/fi';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useNodesData } from '@xyflow/react';

interface WebsiteNodePreviewProps {
  nodeId: string;
}

const WebsiteNodePreviewComponent = memo(({ nodeId }: WebsiteNodePreviewProps) => {
  const { t } = useTranslation();
  const { data } = useNodesData<CanvasNode<WebsiteNodeMeta>>(nodeId) || {};

  const { url = '', viewMode = 'form' } = data?.metadata ?? {};
  const [isEditing, setIsEditing] = useState(viewMode === 'form' || !url);
  const formRef = useRef<any>(null);
  const setNodeDataByEntity = useSetNodeDataByEntity();
  const { readonly } = useCanvasContext();

  // Sync editing state with metadata changes
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

  // Toggle between form and preview modes
  const toggleMode = useCallback(() => {
    setIsEditing((prev) => !prev);
    setNodeDataByEntity(
      {
        type: 'website',
        entityId: data?.entityId,
      },
      {
        metadata: {
          ...data?.metadata,
          viewMode: isEditing ? 'preview' : 'form',
        },
      },
    );
  }, [data?.entityId, data?.metadata, isEditing, setNodeDataByEntity]);

  // Handle form submission to save URL
  const handleSubmit = useCallback(
    (values: { url: string }) => {
      if (!values.url) {
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
          entityId: data?.entityId,
        },
        {
          metadata: {
            ...data?.metadata,
            url: formattedUrl,
            viewMode: 'preview',
          },
        },
      );
      setIsEditing(false);
    },
    [data?.entityId, data?.metadata, setNodeDataByEntity, t],
  );

  // Open website in a new tab
  const handleOpenInNewTab = useCallback(() => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [url]);

  // Handle copy URL to clipboard
  const handleCopyUrl = useCallback(async () => {
    if (url) {
      try {
        await navigator.clipboard.writeText(url);
        message.success(t('canvas.nodes.website.urlCopied', 'URL copied to clipboard'));
      } catch (err: any) {
        console.error(err);
        message.error(t('canvas.nodes.website.copyFailed', 'Failed to copy URL'));
      }
    }
  }, [url, t]);

  // If no URL or in form mode, show the form
  if (isEditing) {
    return (
      <div className="p-4 w-full h-full flex flex-col">
        <div className="flex justify-between mb-4">
          <div className="text-lg font-medium">
            {t('canvas.nodes.website.addWebsite', 'Add Website')}
          </div>
          {url && (
            <Button type="text" icon={<FiEye />} onClick={toggleMode} className="flex items-center">
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
          <Button type="text" icon={<FiCode />} onClick={toggleMode} className="flex items-center">
            {t('canvas.nodes.website.edit', 'Edit')}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          key={url}
          src={url}
          title={data?.title || url}
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
});

export const WebsiteNodePreview = memo(WebsiteNodePreviewComponent, (prevProps, nextProps) => {
  // Optimize re-renders by only updating when necessary node data changes
  const prevUrl = prevProps.nodeId;
  const nextUrl = nextProps.nodeId;

  return prevUrl === nextUrl;
});

WebsiteNodePreview.displayName = 'WebsiteNodePreview';
