import { useEffect, useState, memo, useCallback } from 'react';
import { useDebounce } from 'use-debounce';

import { Input, Spin } from '@arco-design/web-react';
import { Button, Divider, message, Tooltip } from 'antd';
import {
  IconCopy,
  IconLock,
  IconUnlock,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';

import { PureCollaborativeEditor } from '@refly-packages/ai-workspace-common/components/document/pure-collab-editor';
import { useDocumentContext } from '@refly-packages/ai-workspace-common/context/document';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { ydoc2Markdown } from '@refly-packages/utils/editor';
import { time } from '@refly-packages/utils/time';
import { LOCALE } from '@refly/common-types';
import { useDocumentSync } from '@refly-packages/ai-workspace-common/hooks/use-document-sync';
import { TiArrowBackOutline } from 'react-icons/ti';
import { useNavigate } from 'react-router-dom';
import { SiderCollapse } from '@refly-packages/ai-workspace-common/components/canvas/top-toolbar/sider-collapse';

const StatusBar = memo(
  ({ docId }: { docId: string }) => {
    const { provider, ydoc } = useDocumentContext();

    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const language = i18n.language as LOCALE;

    const [unsyncedChanges, setUnsyncedChanges] = useState(provider?.unsyncedChanges || 0);
    const [debouncedUnsyncedChanges] = useDebounce(unsyncedChanges, 500);

    const handleUnsyncedChanges = useCallback((data: number) => {
      setUnsyncedChanges(data);
    }, []);

    useEffect(() => {
      provider.on('unsyncedChanges', handleUnsyncedChanges);
      return () => {
        provider.off('unsyncedChanges', handleUnsyncedChanges);
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
          if (provider.status === 'connected') {
            setDocumentReadOnly(docId, yReadOnly?.toJSON() === 'true');
          }
        };
        yReadOnly?.observe(observer);

        return () => {
          yReadOnly?.unobserve(observer);
        };
      }
    }, [ydoc, docId, setDocumentReadOnly, provider.status]);

    const toggleReadOnly = () => {
      ydoc?.transact(() => {
        const yReadOnly = ydoc.getText('readOnly');
        yReadOnly.delete(0, yReadOnly?.length ?? 0);
        yReadOnly.insert(0, (!readOnly).toString());
      });

      setDocumentReadOnly(docId, !readOnly);

      readOnly
        ? message.success(t('knowledgeBase.note.edit'))
        : message.warning(t('knowledgeBase.note.readOnly'));
    };

    const handleCopy = () => {
      const title = ydoc.getText('title').toJSON();
      const content = ydoc2Markdown(ydoc);
      copyToClipboard(`# ${title}\n\n${content}`);
      message.success({ content: t('contentDetail.item.copySuccess') });
    };

    return (
      <div className="w-full h-10 p-3 border-x-0 border-t-0 border-b border-solid border-gray-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <SiderCollapse />

          <Button
            type="text"
            className="px-[4px]"
            icon={<TiArrowBackOutline size={16} className="text-gray-500" />}
            onClick={() => {
              navigate(-1);
            }}
          >
            <span className="text-gray-500">{t('common.back')}</span>
          </Button>

          <Divider type="vertical" className="pr-[4px] h-4" />

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
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.docId === nextProps.docId;
  },
);

const DocumentEditorHeader = memo(
  ({ docId }: { docId: string }) => {
    const { t } = useTranslation();
    const { document } = useDocumentStoreShallow((state) => ({
      document: state.data[docId]?.document,
    }));
    const { syncTitleToYDoc } = useDocumentSync();

    const onTitleChange = (newTitle: string) => {
      syncTitleToYDoc(newTitle);
    };

    return (
      <div className="w-full">
        <div className="mx-0 mt-4 max-w-screen-lg">
          <Input
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
    const { provider } = useDocumentContext();

    const { config } = useDocumentStoreShallow((state) => ({
      config: state.config[docId],
    }));
    const hasDocumentSynced = config?.remoteSyncedAt > 0 && config?.localSyncedAt > 0;

    return (
      <div className="overflow-auto flex-grow">
        <Spin
          className="document-editor-spin"
          tip={t('knowledgeBase.note.connecting')}
          loading={!hasDocumentSynced && provider.status !== 'connected'}
          style={{ height: '100%', width: '100%' }}
        >
          <div className="ai-note-editor">
            <div className="ai-note-editor-container">
              <DocumentEditorHeader docId={docId} />
              <PureCollaborativeEditor docId={docId} />
            </div>
          </div>
        </Spin>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.docId === nextProps.docId,
);

export const DocumentDetail = memo(
  ({ docId }: { docId: string }) => {
    const { resetState } = useDocumentStoreShallow((state) => ({
      resetState: state.resetState,
    }));

    useEffect(() => {
      return () => {
        resetState(docId);
      };
    }, []);

    return (
      <div className="flex flex-col ai-note-container">
        <StatusBar docId={docId} />
        <DocumentBody docId={docId} />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.docId === nextProps.docId;
  },
);
