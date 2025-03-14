import { useEffect, useState, memo, useCallback } from 'react';
import { useDebounce } from 'use-debounce';

import './index.scss';
import { Input, Spin } from '@arco-design/web-react';
import { Button, message, Tooltip } from 'antd';
import {
  IconCopy,
  IconLock,
  IconUnlock,
  IconShare,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';

import { CollaborativeEditor } from './collab-editor';
import { ReadonlyEditor } from './readonly-editor';
import {
  DocumentProvider,
  useDocumentContext,
} from '@refly-packages/ai-workspace-common/context/document';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { ydoc2Markdown } from '@refly-packages/utils/editor';
import { time } from '@refly-packages/utils/time';
import { LOCALE } from '@refly/common-types';
import { useDocumentSync } from '@refly-packages/ai-workspace-common/hooks/use-document-sync';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

const StatusBar = memo(
  ({ docId }: { docId: string }) => {
    const { provider, ydoc } = useDocumentContext();

    const { t, i18n } = useTranslation();
    const language = i18n.language as LOCALE;

    const [unsyncedChanges, setUnsyncedChanges] = useState(provider?.unsyncedChanges || 0);
    const [debouncedUnsyncedChanges] = useDebounce(unsyncedChanges, 500);
    const [isSharing, setIsSharing] = useState(false);

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

    const handleShare = useCallback(async () => {
      if (!ydoc) return;

      setIsSharing(true);
      const loadingMessage = message.loading(t('document.sharing', 'Sharing document...'), 0);

      try {
        const title = ydoc.getText('title').toJSON();
        const content = ydoc2Markdown(ydoc);
        const documentData = {
          title,
          content,
        };

        // Create share using the API
        const { data, error } = await getClient().createShare({
          body: {
            entityId: docId,
            entityType: 'document',
            shareData: JSON.stringify(documentData),
          },
        });

        if (!data.success || error) {
          throw new Error(error ? String(error) : 'Failed to share document');
        }

        // Generate share link
        const shareLink = getShareLink('document', data.data?.shareId ?? '');

        // Copy the sharing link to clipboard
        copyToClipboard(shareLink);

        // Clear loading message and show success
        loadingMessage();
        message.success(
          t('document.shareSuccess', 'Document shared successfully! Link copied to clipboard.'),
        );
      } catch (err) {
        console.error('Failed to share document:', err);
        loadingMessage();
        message.error(t('document.shareError', 'Failed to share document'));
      } finally {
        setIsSharing(false);
      }
    }, [ydoc, docId, t]);

    return (
      <div className="w-full h-10 p-3 border-x-0 border-t-0 border-b border-solid border-gray-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`
                  relative w-2.5 h-2.5 rounded-full
                  transition-colors duration-700 ease-in-out
                  ${debouncedUnsyncedChanges > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-400'}
                `}
          />
          <div className="text-sm text-gray-500">
            {debouncedUnsyncedChanges > 0
              ? t('canvas.toolbar.syncingChanges')
              : t('canvas.toolbar.synced', { time: time(new Date(), language)?.utc()?.fromNow() })}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip
            placement="bottom"
            title={readOnly ? t('document.enableEdit') : t('document.setReadOnly')}
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
          <Tooltip placement="bottom" title={t('document.share', 'Share document')}>
            <Button
              type="text"
              icon={<IconShare className="text-gray-500" />}
              onClick={handleShare}
              loading={isSharing}
              title={t('document.share', 'Share document')}
            />
          </Tooltip>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.docId === nextProps.docId;
  },
);

const DocumentEditorHeader = memo(
  ({ docId, readonly }: { docId: string; readonly?: boolean }) => {
    const { t } = useTranslation();
    const { document } = useDocumentStoreShallow((state) => ({
      document: state.data[docId]?.document,
    }));
    const { syncTitleToYDoc } = useDocumentSync();

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
    };

    return (
      <div className="w-full">
        <div className="mx-0 mt-4 max-w-screen-lg">
          <Input
            readOnly={readonly}
            className="document-title !text-3xl font-bold focus:!border-transparent focus:!bg-transparent"
            placeholder={t('editor.placeholder.title')}
            value={document?.title}
            style={{ paddingLeft: 6 }}
            onChange={onTitleChange}
          />
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.docId === nextProps.docId,
);

const DocumentBody = memo(
  ({ docId }: { docId: string }) => {
    const { t } = useTranslation();
    const { readonly, isLoading } = useDocumentContext();

    const { config } = useDocumentStoreShallow((state) => ({
      config: state.config[docId],
    }));
    const hasDocumentSynced = config?.remoteSyncedAt > 0 && config?.localSyncedAt > 0;

    return (
      <div className="overflow-auto flex-grow">
        <Spin
          className="document-editor-spin"
          tip={t('knowledgeBase.note.connecting')}
          loading={isLoading && !hasDocumentSynced}
          style={{ height: '100%', width: '100%' }}
        >
          <div className="ai-note-editor">
            <div className="ai-note-editor-container">
              <DocumentEditorHeader docId={docId} readonly={readonly} />
              {readonly ? <ReadonlyEditor docId={docId} /> : <CollaborativeEditor docId={docId} />}
            </div>
          </div>
        </Spin>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.docId === nextProps.docId,
);

export const DocumentEditor = memo(
  ({ docId, shareId, readonly }: { docId: string; shareId?: string; readonly?: boolean }) => {
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
          {!canvasReadOnly && <StatusBar docId={docId} />}
          <DocumentBody docId={docId} />
        </div>
      </DocumentProvider>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.docId === nextProps.docId;
  },
);
