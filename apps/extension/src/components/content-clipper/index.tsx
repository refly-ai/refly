import React, { useCallback, useState, useEffect } from 'react';
import { Button, Divider, Input, message, Tooltip, Form, Collapse } from 'antd';
import { IconDelete, IconPaste } from '@arco-design/web-react/icon';
import { HiOutlineDocumentDownload } from 'react-icons/hi';
import { useTranslation } from 'react-i18next';
import { useSaveSelectedContent } from '@/hooks/use-save-selected-content';
import { useSaveResourceNotify } from '@refly-packages/ai-workspace-common/hooks/use-save-resouce-notify';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  onMessage,
  sendMessage,
} from '@refly-packages/ai-workspace-common/utils/extension/messaging';
import { BackgroundMessage } from '@refly/common-types';
import { getRuntime } from '@refly/utils/env';

const { TextArea } = Input;
const { Panel } = Collapse;

interface ContentClipperProps {
  className?: string;
  onSaveSuccess?: () => void;
}

interface PageContent {
  title: string;
  url: string;
  content: string;
}

export const ContentClipper: React.FC<ContentClipperProps> = ({ className, onSaveSuccess }) => {
  const { t } = useTranslation();
  const [pageInfo, setPageInfo] = useState<PageContent>({
    title: '',
    url: '',
    content: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isClipping, setIsClipping] = useState(false);
  const { saveSelectedContent } = useSaveSelectedContent();
  const { handleSaveResourceAndNotify } = useSaveResourceNotify();

  const setPageContentResponse = async (data: BackgroundMessage) => {
    const response = data;
    if (response?.body) {
      try {
        // Convert HTML content to Markdown if it exists
        if (response.body.content) {
          // Create a Blob from the HTML content
          const htmlBlob = new Blob([response.body.content], { type: 'text/html' });
          const htmlFile = new File([htmlBlob], 'content.html', { type: 'text/html' });

          // Create FormData and append the file
          const formData = new FormData();
          formData.append('file', htmlFile);

          const result = await getClient().convert({
            body: {
              from: 'html',
              to: 'markdown',
              file: htmlFile,
            },
          });

          if (result?.data?.data?.content) {
            setPageInfo({
              ...response.body,
              content: result.data.data.content,
            });
          } else {
            setPageInfo(response.body);
          }
        } else {
          setPageInfo(response.body);
        }
      } catch (err) {
        console.error('Failed to convert HTML to Markdown:', err);
        setPageInfo(response.body);
      }
    }
    setIsClipping(false);
  };

  // Listen for content from content script
  useEffect(() => {
    onMessage((event: MessageEvent<any>) => {
      const data = event as any as BackgroundMessage;
      if (data?.name === 'getPageContentResponse') {
        setPageContentResponse(data);
      }
    }, getRuntime());
  }, []);

  // Handle clip current page content
  const handleClipContent = useCallback(async () => {
    try {
      setIsClipping(true);
      // Send message to content script to get page content
      const msg: BackgroundMessage = {
        source: getRuntime(),
        name: 'getPageContent',
      };
      sendMessage(msg);
    } catch (err) {
      setIsClipping(false);
      console.error('Failed to clip content:', err);
      message.error(t('translation:extension.webClipper.error.clipContentFailed'));
    }
  }, [t]);

  // Handle get clipboard content
  const handleGetClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPageInfo((prev) => ({ ...prev, content: text }));
      } else {
        message.warning(t('translation:extension.webClipper.error.clipboardEmpty'));
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      message.error(t('translation:extension.webClipper.error.clipboardReadFailed'));
    }
  }, [t]);

  // Handle save content
  const handleSave = useCallback(async () => {
    if (!pageInfo.content?.trim()) {
      message.warning(t('translation:extension.webClipper.error.contentRequired'));
      return;
    }

    setIsSaving(true);
    try {
      // Use handleSaveResourceAndNotify to handle saving with notification
      await handleSaveResourceAndNotify(async () => {
        const result = await saveSelectedContent(pageInfo.content, {
          title: pageInfo.title,
          url: pageInfo.url,
        });
        if (result?.res?.success) {
          setTimeout(() => {
            setPageInfo({ title: '', url: '', content: '' });
            onSaveSuccess?.();
          }, 100);
        }
        return result;
      });
    } catch (err) {
      console.error('Failed to save content:', err);
      message.error(t('translation:extension.webClipper.error.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [pageInfo, saveSelectedContent, handleSaveResourceAndNotify, t, onSaveSuccess]);

  // Handle clear content
  const handleClear = useCallback(() => {
    setPageInfo({ title: '', url: '', content: '' });
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Save on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  // Handle content change
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPageInfo((prev) => ({ ...prev, content: e.target.value }));
  }, []);

  // Handle title change
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPageInfo((prev) => ({ ...prev, title: e.target.value }));
  }, []);

  // Handle URL change
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPageInfo((prev) => ({ ...prev, url: e.target.value }));
  }, []);

  return (
    <div className={`flex flex-col gap-4 p-0 ${className}`}>
      <div className="flex flex-col gap-2">
        <Form layout="vertical" className="content-clipper-form">
          <TextArea
            placeholder={t('translation:extension.webClipper.placeholder.enterOrClipContent')}
            value={pageInfo.content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            autoSize={{ minRows: 10, maxRows: 10 }}
            className="w-full resize-none"
          />
          <Collapse ghost className="m-0 p-0 content-clipper-collapse">
            <Panel
              header={t('translation:extension.webClipper.placeholder.metadata')}
              key="metadata"
            >
              <Form.Item label={t('translation:extension.webClipper.placeholder.title')}>
                <TextArea
                  value={pageInfo.title}
                  onChange={handleTitleChange}
                  className="content-clipper-input"
                  rows={1}
                  placeholder={t('translation:extension.webClipper.placeholder.enterTitle')}
                />
              </Form.Item>
              <Form.Item label={t('translation:extension.webClipper.placeholder.url')}>
                <TextArea
                  value={pageInfo.url}
                  onChange={handleUrlChange}
                  className="content-clipper-input"
                  rows={1}
                  placeholder={t('translation:extension.webClipper.placeholder.enterUrl')}
                />
              </Form.Item>
            </Panel>
          </Collapse>
        </Form>

        <div className="flex flex-row justify-end gap-2">
          <div className="flex flex-row gap-2">
            {pageInfo.content && (
              <Button size="small" icon={<IconDelete />} onClick={handleClear}>
                {t('translation:extension.webClipper.action.clear')}
              </Button>
            )}
            <Tooltip title={t('translation:extension.webClipper.info.saveToLibrary')}>
              <Button
                type="primary"
                size="small"
                loading={isSaving}
                disabled={!pageInfo.content?.trim()}
                onClick={handleSave}
              >
                <div className="flex items-center justify-center rounded px-[1px] h-[12px] text-[10px] font-medium leading-none">
                  <span className="text-[10px] font-medium leading-none mr-2">⇧+↵</span>
                  <span className="text-[10px] font-medium leading-none translate-y-[0.5px]">
                    {t('translation:extension.webClipper.action.save')}
                  </span>
                </div>
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
      <Divider className="m-0" />
      <div className="flex flex-row gap-2">
        <Button
          type="primary"
          size="large"
          icon={<HiOutlineDocumentDownload />}
          onClick={handleClipContent}
          loading={isClipping}
          className="flex-1"
        >
          {t('translation:extension.webClipper.action.clip')}
        </Button>
        <Tooltip title={t('translation:extension.webClipper.action.fromClipboard')}>
          <Button size="large" icon={<IconPaste />} onClick={handleGetClipboard} />
        </Tooltip>
      </div>
    </div>
  );
};
