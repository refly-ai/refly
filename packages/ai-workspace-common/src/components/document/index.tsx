import { useEffect, useState, memo, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { useSearchParams } from 'react-router-dom';

import './index.scss';
import { Button, message, Tooltip, Input } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import {
  IconCopy,
  IconLock,
  IconUnlock,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { useDocumentStoreShallow } from '@refly/stores';

import { CollaborativeEditor } from './collab-editor';
import { ReadonlyEditor } from './readonly-editor';
import {
  DocumentProvider,
  useDocumentContext,
} from '@refly-packages/ai-workspace-common/context/document';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { ydoc2Markdown } from '@refly/utils/editor';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useDocumentSync } from '@refly-packages/ai-workspace-common/hooks/use-document-sync';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { editorEmitter } from '@refly/utils/event-emitter/editor';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useSiderStoreShallow } from '@refly/stores';
import { useReactFlow } from '@xyflow/react';

// Define the table of contents item type
interface TocItem {
  id: string;
  text: string;
  level: number;
  element: HTMLElement;
  isActive?: boolean;
  index?: string; // For displaying numbering of toc items
  parentIndex?: number; // To determine parent toc item
}

// Simplified TOC component
const DocumentToc = memo(() => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TocItem[]>([]);

  // Handle TOC item click
  const handleTocItemClick = (item: TocItem) => {
    if (item.element) {
      item.element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Process TOC items hierarchy and numbering
  const processTocItems = (tocItems: TocItem[]): TocItem[] => {
    return tocItems.map((item) => {
      return {
        ...item,
        index: '',
      };
    });
  };

  // Extract headings from document
  useEffect(() => {
    const extractHeadings = () => {
      // Find editor container
      const editorContent = document.querySelector('.ai-note-editor-content-container');
      if (!editorContent) return;

      // Find all heading elements
      const headings = editorContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length === 0) {
        setItems([]);
        return;
      }

      const tocItems: TocItem[] = [];

      headings.forEach((heading, index) => {
        const element = heading as HTMLElement;
        const level = Number.parseInt(element.tagName.substring(1), 10);
        const text = element.textContent || '';
        const id = `toc-heading-${index}`;

        // Set ID for navigation
        element.id = id;

        tocItems.push({
          id,
          text,
          level,
          element,
          isActive: false,
        });
      });

      // Process TOC hierarchy and numbering
      const processedItems = processTocItems(tocItems);
      setItems(processedItems);
    };

    // Wait for DOM to complete loading
    setTimeout(extractHeadings);
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="w-60 border-l border-gray-200">
      <div className="toc-container">
        <div className="text-lg">{t('document.tableOfContents', 'Table of contents')}</div>
        <div className="toc-list">
          {items.map((item) => (
            <div
              key={item.id}
              className={`toc-item cursor-pointer ${item.isActive ? 'active' : ''}`}
              data-level={item.level}
              onClick={() => handleTocItemClick(item)}
            >
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

const StatusBar = memo(({ docId }: { docId: string }) => {
  const { provider, ydoc } = useDocumentContext();

  const { t, i18n } = useTranslation();
  const language = i18n.language as LOCALE;

  const [unsyncedChanges, setUnsyncedChanges] = useState(provider?.unsyncedChanges || 0);
  const [debouncedUnsyncedChanges] = useDebounce(unsyncedChanges, 500);

  const handleUnsyncedChanges = useCallback((data: number) => {
    setUnsyncedChanges(data);
  }, []);

  useEffect(() => {
    provider?.on('unsyncedChanges', handleUnsyncedChanges);
    return () => {
      provider?.off('unsyncedChanges', handleUnsyncedChanges);
    };
  }, [provider, handleUnsyncedChanges]);

  const { config, setDocumentReadOnly } = useDocumentStoreShallow((state) => ({
    config: state.config[docId],
    setDocumentReadOnly: state.setDocumentReadOnly,
  }));
  const readOnly = config?.readOnly;

  useEffect(() => {
    if (ydoc) {
      const yReadOnly = ydoc?.getText('readOnly');
      setDocumentReadOnly(docId, yReadOnly?.toJSON() === 'true');

      const observer = () => {
        if (provider?.status === 'connected') {
          setDocumentReadOnly(docId, yReadOnly?.toJSON() === 'true');
        }
      };
      yReadOnly?.observe(observer);

      return () => {
        yReadOnly?.unobserve(observer);
      };
    }
  }, [ydoc, docId, setDocumentReadOnly, provider?.status]);

  const toggleReadOnly = () => {
    if (!ydoc || provider?.status !== 'connected') {
      message.error(t('knowledgeBase.note.connectionError') || 'Connection error');
      return;
    }

    try {
      ydoc.transact(() => {
        const yReadOnly = ydoc.getText('readOnly');
        if (!yReadOnly) return;

        yReadOnly.delete(0, yReadOnly.length ?? 0);
        yReadOnly.insert(0, (!readOnly).toString());
      });

      setDocumentReadOnly(docId, !readOnly);

      readOnly
        ? message.success(t('knowledgeBase.note.edit'))
        : message.warning(t('knowledgeBase.note.readOnly'));
    } catch (error) {
      console.error('Transaction error when toggling read-only:', error);

      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        console.warn('Database connection is closing. Transaction aborted.');
        message.error(t('knowledgeBase.note.databaseError') || 'Database connection error');
      }
    }
  };

  const handleCopy = () => {
    const title = ydoc.getText('title').toJSON();
    const content = ydoc2Markdown(ydoc);
    copyToClipboard(`# ${title}\n\n${content}`);
    message.success({ content: t('contentDetail.item.copySuccess') });
  };

  return (
    <div className="w-full pt-3 border-x-0 border-b-0 border-t-[1px] border-solid border-refly-Card-Border">
      {/* Status bar with follow-up button */}
      <div className="h-10 p-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-1">
          <Tooltip
            placement="bottom"
            title={
              readOnly
                ? t('document.enableEdit', 'Enable editing')
                : t('document.setReadOnly', 'Set to read-only')
            }
          >
            <Button
              type="text"
              icon={
                readOnly ? (
                  <IconLock className="text-green-500" />
                ) : (
                  <IconUnlock className="text-gray-500" />
                )
              }
              onClick={() => toggleReadOnly()}
            />
          </Tooltip>
          <Tooltip placement="bottom" title={t('common.copy.title')}>
            <Button
              type="text"
              icon={<IconCopy className="text-gray-500" />}
              onClick={() => handleCopy()}
              title={t('common.copy.title')}
            />
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`
                    relative w-2.5 h-2.5 rounded-full
                    transition-colors duration-700 ease-in-out
                    ${debouncedUnsyncedChanges > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-400'}
                  `}
          />
          <div className="text-xs text-refly-text-1">
            {debouncedUnsyncedChanges > 0
              ? t('canvas.toolbar.syncingChanges')
              : t('canvas.toolbar.synced', {
                  time: time(new Date(), language)?.utc()?.fromNow(),
                })}
          </div>
        </div>
      </div>
    </div>
  );
});

interface DocumentEditorHeaderProps {
  docId: string;
  nodeId: string;
  readonly?: boolean;
}

const DocumentEditorHeader = memo(({ docId, nodeId, readonly }: DocumentEditorHeaderProps) => {
  const { getNode } = useReactFlow();
  const node = getNode(nodeId);

  const { t } = useTranslation();
  const { projectId } = useGetProjectCanvasId();
  const { document } = useDocumentStoreShallow((state) => ({
    document: state.data[docId]?.document,
  }));
  const { sourceList, setSourceList } = useSiderStoreShallow((state) => ({
    sourceList: state.sourceList,
    setSourceList: state.setSourceList,
  }));
  const { syncTitleToYDoc } = useDocumentSync();
  const { provider } = useDocumentContext();

  const setNodeDataByEntity = useSetNodeDataByEntity();

  const onTitleChange = (newTitle: string) => {
    syncTitleToYDoc(newTitle);
    setNodeDataByEntity(
      {
        entityId: docId,
        type: 'document',
      },
      {
        title: newTitle,
      },
    );

    if (projectId) {
      const source = sourceList.find((s) => s.id === docId);
      if (source) {
        setSourceList(sourceList.map((s) => (s.id === docId ? { ...s, title: newTitle } : s)));
      }
    }
  };

  useEffect(() => {
    const handleSyncTitle = (data: { docId: string; title: string }) => {
      if (data.docId === docId) {
        syncTitleToYDoc(data.title);
      }
    };

    editorEmitter.on('syncDocumentTitle', handleSyncTitle);

    return () => {
      editorEmitter.off('syncDocumentTitle', handleSyncTitle);
    };
  }, [docId, syncTitleToYDoc]);

  useEffect(() => {
    if (provider?.status !== 'connected') return;
    const timer = setTimeout(() => {
      syncTitleToYDoc((node?.data?.title as string) ?? '');
    }, 100);
    return () => {
      clearTimeout(timer);
      syncTitleToYDoc((node?.data?.title as string) ?? '');
    };
  }, [provider?.status]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Skip custom handling when IME composition is in progress
    if (e.nativeEvent.isComposing || e.key === 'Process') {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      editorEmitter.emit('insertBelow', '\n');
    }
  }, []);

  return (
    <div className="w-full mx-0 mt-4 max-w-screen-lg">
      <Input
        readOnly={readonly}
        className="document-title !text-3xl font-bold bg-transparent !border-none focus:!bg-transparent  hover:bg-gray-50 dark:hover:bg-white/10"
        placeholder={t('editor.placeholder.title')}
        value={document?.title}
        style={{ paddingLeft: 6 }}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
});

interface DocumentBodyProps {
  docId: string;
  nodeId: string;
}

const DocumentBody = memo(({ docId, nodeId }: DocumentBodyProps) => {
  const { t } = useTranslation();
  const { readonly, isLoading, isShareDocumentLoading, provider, ydoc } = useDocumentContext();
  const [searchParams] = useSearchParams();
  const isMaximized = searchParams.get('isMaximized') === 'true';

  const { config } = useDocumentStoreShallow((state) => ({
    config: state.config[docId],
  }));
  const hasDocumentSynced = config?.remoteSyncedAt > 0 && config?.localSyncedAt > 0;
  const isStillLoading = (isLoading && !hasDocumentSynced) || provider?.status !== 'connected';

  useEffect(() => {
    const onShare = async () => {
      if (!ydoc) return;
      const loadingMessage = message.loading(t('document.sharing', 'Sharing document...'), 0);
      try {
        const title = ydoc.getText('title').toJSON();
        const content = ydoc2Markdown(ydoc);
        const documentData = { title, content };
        const { data, error } = await getClient().createShare({
          body: {
            entityId: docId,
            entityType: 'document',
            shareData: JSON.stringify(documentData),
          },
        });
        if (!data?.success || error) {
          throw new Error(error ? String(error) : 'Failed to share document');
        }
        const shareLink = getShareLink('document', data.data?.shareId ?? '');
        copyToClipboard(shareLink);
        loadingMessage();
        message.success(
          t('document.shareSuccess', 'Document shared successfully! Link copied to clipboard.'),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to share document:', err);
        loadingMessage();
        message.error(t('document.shareError', 'Failed to share document'));
      } finally {
        editorEmitter.emit('shareDocumentCompleted');
      }
    };
    editorEmitter.on('shareDocument', onShare);
    return () => {
      editorEmitter.off('shareDocument', onShare);
    };
  }, [docId, t, ydoc]);

  return (
    <div className="overflow-auto flex-grow">
      <Spin
        className="document-editor-spin"
        tip={t('knowledgeBase.note.connecting')}
        spinning={readonly ? isShareDocumentLoading : isStillLoading}
        style={{ height: '100%', width: '100%' }}
      >
        <div className="ai-note-editor">
          <div className="ai-note-editor-container">
            <DocumentEditorHeader docId={docId} nodeId={nodeId} readonly={readonly} />

            <div className="flex flex-row w-full">
              <div className={`flex-1 w-full ${isMaximized ? 'mr-4' : ''}`}>
                {readonly ? (
                  <ReadonlyEditor docId={docId} />
                ) : (
                  <CollaborativeEditor docId={docId} />
                )}
              </div>
              {isMaximized && <DocumentToc />}
            </div>
          </div>
        </div>
      </Spin>
    </div>
  );
});

export const DocumentEditor = memo(
  ({
    docId,
    shareId,
    readonly,
    nodeId,
  }: {
    docId: string;
    shareId?: string;
    readonly?: boolean;
    _isMaximized?: boolean;
    nodeId: string;
  }) => {
    const { resetState } = useDocumentStoreShallow((state) => ({
      resetState: state.resetState,
    }));
    const { readonly: canvasReadOnly } = useCanvasContext();

    useEffect(() => {
      return () => {
        resetState(docId);
      };
    }, []);

    return (
      <DocumentProvider docId={docId} shareId={shareId} readonly={readonly}>
        <div className="flex flex-col ai-note-container">
          <DocumentBody docId={docId} nodeId={nodeId} />
          {!canvasReadOnly && <StatusBar docId={docId} />}
        </div>
      </DocumentProvider>
    );
  },
);
