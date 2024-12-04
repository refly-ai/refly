import { memo, useEffect, useMemo, useRef, useState } from 'react';
import wordsCount from 'words-count';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CanvasNodeType, Document } from '@refly/openapi-schema';

import './index.scss';
import { Input, Popover, Spin } from '@arco-design/web-react';
import { HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineClock, HiOutlineShare } from 'react-icons/hi2';
import { IconQuote } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { editorEmitter } from '@refly-packages/utils/event-emitter/editor';

import {
  CollabEditorCommand,
  CollabGenAIMenuSwitch,
  CollabGenAIBlockMenu,
} from '@refly-packages/ai-workspace-common/components/editor/components/advanced-editor';
import {
  EditorRoot,
  EditorContent,
  EditorInstance,
} from '@refly-packages/ai-workspace-common/components/editor/core/components';

import {
  configureHighlightJs,
  ImageResizer,
  handleCommandNavigation,
} from '@refly-packages/ai-workspace-common/components/editor/core/extensions';
import {
  defaultExtensions,
  Placeholder,
} from '@refly-packages/ai-workspace-common/components/editor/components/extensions';
import { createUploadFn } from '@refly-packages/ai-workspace-common/components/editor/components/image-upload';
import { configureSlashCommand } from '@refly-packages/ai-workspace-common/components/editor/components/slash-command';
import Collaboration from '@tiptap/extension-collaboration';
import { useDebouncedCallback } from 'use-debounce';
import { handleImageDrop, handleImagePaste } from '@refly-packages/ai-workspace-common/components/editor/core/plugins';
import { getHierarchicalIndexes, TableOfContents } from '@tiptap-pro/extension-table-of-contents';

import { DeleteDropdownMenu } from './dropdown';
import { AiOutlineWarning } from 'react-icons/ai';
import { getWsServerOrigin } from '@refly-packages/utils/url';
import { useDocumentStore, useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';
import { useCanvasTabs } from '@refly-packages/ai-workspace-common/hooks/use-canvas-tabs';

// content selector
import '@refly-packages/ai-workspace-common/modules/content-selector/styles/content-selector.scss';
import classNames from 'classnames';
import { useContentSelectorStore } from '@refly-packages/ai-workspace-common/modules/content-selector/stores/content-selector';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
// componets
import { ToC } from './ToC';
import { IconBook } from '@arco-design/web-react/icon';
import { Button, Divider, message, Modal } from 'antd';
import { useHandleShare } from '@refly-packages/ai-workspace-common/hooks/use-handle-share';
import { useReferencesStoreShallow } from '@refly-packages/ai-workspace-common/stores/references';
import { useBlocker } from 'react-router-dom';
import { genUniqueId } from '@refly-packages/utils/id';
import { useSelectionContext } from '@refly-packages/ai-workspace-common/hooks/use-selection-context';
import { DocumentProvider, useDocumentContext } from '@refly-packages/ai-workspace-common/context/document';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';

const MemorizedToC = memo(ToC);

const CollaborativeEditor = ({ docId }: { docId: string }) => {
  const { t } = useTranslation();
  const lastCursorPosRef = useRef<number>();

  const documentStore = useDocumentStoreShallow((state) => ({
    isAiEditing: state.isAiEditing,
    currentDocument: state.currentDocument,
    documentServerStatus: state.documentServerStatus,
    updateIsAiEditing: state.updateIsAiEditing,
    updateCurrentDocument: state.updateCurrentDocument,
    updateDocumentCharsCount: state.updateDocumentCharsCount,
    updateDocumentSaveStatus: state.updateDocumentSaveStatus,
    updateDocumentServerStatus: state.updateDocumentServerStatus,
    updateEditor: state.updateEditor,
    updateTocItems: state.updateTocItems,
    updateLastCursorPosRef: state.updateLastCursorPosRef,
  }));

  const contextPanelStore = useContextPanelStore((state) => ({
    updateBeforeSelectionNoteContent: state.updateBeforeSelectionNoteContent,
    updateAfterSelectionNoteContent: state.updateAfterSelectionNoteContent,
    updateCurrentSelectionContent: state.updateCurrentSelectionContent,
  }));

  const editorRef = useRef<EditorInstance>();

  const { showContentSelector, scope } = useContentSelectorStore((state) => ({
    showContentSelector: state.showContentSelector,
    scope: state.scope,
  }));

  const createPlaceholderExtension = () => {
    return Placeholder.configure({
      placeholder: ({ node }) => {
        const defaultPlaceholder = t('knowledgeBase.canvas.editor.placeholder.default', {
          defaultValue: "Write something, or press 'space' for AI, '/' for commands",
        });

        switch (node.type.name) {
          case 'heading':
            return t('editor.placeholder.heading', {
              level: node.attrs.level,
              defaultValue: `Heading ${node.attrs.level}`,
            });
          case 'paragraph':
            return defaultPlaceholder;
          case 'codeBlock':
          case 'orderedList':
          case 'bulletList':
          case 'listItem':
          case 'taskList':
          case 'taskItem':
            return '';
          default:
            return defaultPlaceholder;
        }
      },
      includeChildren: true,
    });
  };

  const { addToContext, selectedText } = useSelectionContext({
    containerClass: 'ai-note-editor-content-container',
  });

  const buildNodeData = (text: string) => {
    const { currentDocument } = useDocumentStore.getState();

    return {
      id: genUniqueId(),
      type: 'document' as CanvasNodeType,
      position: { x: 0, y: 0 },
      data: {
        entityId: currentDocument?.docId ?? '',
        title: currentDocument?.title ?? 'Selected Content',
        metadata: {
          contentPreview: text,
          selectedContent: text,
          xPath: genUniqueId(),
          sourceEntityId: currentDocument?.docId ?? '',
          sourceEntityType: 'document',
          sourceType: 'documentSelection',
        },
      },
    };
  };

  const handleAddToContext = (text: string) => {
    const node = buildNodeData(text);

    addToContext(node);
  };

  const { provider } = useDocumentContext();

  const uploadFn = useMemo(() => createUploadFn({ entityId: docId, entityType: 'document' }), [docId]);

  const extensions = useMemo(
    () => [
      ...defaultExtensions,
      configureSlashCommand({
        entityId: docId,
        entityType: 'document',
      }),
      createPlaceholderExtension(),
      Collaboration.configure({
        document: provider.document,
      }),
      TableOfContents.configure({
        getIndex: getHierarchicalIndexes,
        onUpdate(content) {
          documentStore.updateTocItems(content);
        },
      }),
    ],
    [provider, docId],
  );

  // Apply Codeblock Highlighting on the HTML from editor.getHTML()
  const highlightCodeblocks = async (content: string) => {
    const hljs = await configureHighlightJs();
    const doc = new DOMParser().parseFromString(content, 'text/html');
    doc.querySelectorAll('pre code').forEach((el) => {
      // @ts-ignore
      // https://highlightjs.readthedocs.io/en/latest/api.html?highlight=highlightElement#highlightelement
      hljs.highlightElement(el);
    });
    return new XMLSerializer().serializeToString(doc);
  };

  const { setNodeDataByEntity } = useCanvasControl();

  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    const json = editor.getJSON();
    const markdown = editor.storage.markdown.getMarkdown();

    setNodeDataByEntity(
      {
        entityId: docId,
        type: 'document',
      },
      {
        contentPreview: markdown?.slice(0, 1000),
      },
    );

    documentStore.updateDocumentCharsCount(wordsCount(markdown));
    window.localStorage.setItem('html-content', await highlightCodeblocks(editor.getHTML()));
    window.localStorage.setItem('novel-content', JSON.stringify(json));
    window.localStorage.setItem('markdown', editor.storage.markdown.getMarkdown());
    documentStore.updateDocumentSaveStatus('Saved');
  }, 500);

  useEffect(() => {
    return () => {
      editorRef.current?.destroy();
    };
  }, [docId]);

  const readOnly = documentStore?.currentDocument?.readOnly ?? false;

  useEffect(() => {
    if (editorRef.current && !readOnly) {
      editorRef.current.on('blur', () => {
        lastCursorPosRef.current = editorRef.current?.view?.state?.selection?.$head?.pos;

        const editor = editorRef.current;
        const { state } = editor?.view || {};
        const { selection } = state || {};
        const { doc } = editor?.state || {};
        const { from, to } = selection || {};

        const getMarkdownSlice = (start: number, end: number) => {
          const slice = doc.slice(start, end);
          return editor.storage.markdown.serializer.serialize(slice.content);
        };

        const prevSelectionContent = getMarkdownSlice(0, from);
        const afterSelectionContent = getMarkdownSlice(to, editor?.state?.doc?.content?.size);
        const selectedContent = getMarkdownSlice(from, to);

        documentStore.updateLastCursorPosRef(lastCursorPosRef.current);
        contextPanelStore.updateCurrentSelectionContent(selectedContent);
        contextPanelStore.updateBeforeSelectionNoteContent(prevSelectionContent);
        contextPanelStore.updateAfterSelectionNoteContent(afterSelectionContent);
      });
    }
  }, [editorRef.current, readOnly]);

  useEffect(() => {
    editorEmitter.on('insertBlow', (content) => {
      const isFocused = editorRef.current?.isFocused;

      if (isFocused) {
        lastCursorPosRef.current = editorRef.current?.view?.state?.selection?.$head?.pos;
        editorRef.current?.commands?.insertContentAt?.(lastCursorPosRef.current, content);
      } else if (lastCursorPosRef.current) {
        editorRef.current
          .chain()
          .focus(lastCursorPosRef.current)
          .insertContentAt(
            {
              from: lastCursorPosRef.current,
              to: lastCursorPosRef.current,
            },
            content,
          )
          .run();
      }
    });
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      if (readOnly) {
        // ensure we sync the content just before setting the editor to readonly
        provider.forceSync();
      }
      editorRef.current.setOptions({ editable: !readOnly });
    }
  }, [readOnly]);

  // Add navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      documentStore.isAiEditing &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  const [modal, contextHolder] = Modal.useModal();

  // Handle blocking navigation
  useEffect(() => {
    if (blocker.state === 'blocked') {
      modal.confirm({
        title: t('knowledgeBase.canvas.leavePageModal.title'),
        content: t('knowledgeBase.canvas.leavePageModal.content'),
        centered: true,
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        onOk: () => {
          documentStore.updateIsAiEditing(false);
          blocker.proceed();
        },
        onCancel: () => {
          blocker.reset();
        },
      });
    }
  }, [blocker]);

  // Add window beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (documentStore.isAiEditing) {
        // Standard-compliant browsers
        const message = 'AI is still editing. Changes you made may not be saved.';
        e.preventDefault();
        e.returnValue = message; // Chrome requires returnValue to be set
        return message; // Safari requires return value
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [documentStore.isAiEditing]);

  return (
    <div
      className={classNames('w-full', 'ai-note-editor-content-container', {
        'refly-selector-mode-active': showContentSelector,
        'refly-block-selector-mode': scope === 'block',
        'refly-inline-selector-mode': scope === 'inline',
      })}
    >
      <div className="w-full h-full">
        {documentStore.isAiEditing && (
          <div
            className="absolute inset-0 bg-transparent z-[1000] pointer-events-auto select-none"
            onMouseDown={(e) => e.preventDefault()}
            onMouseUp={(e) => e.preventDefault()}
            onClick={(e) => e.preventDefault()}
            onDoubleClick={(e) => e.preventDefault()}
          />
        )}
        <EditorRoot>
          <EditorContent
            extensions={extensions}
            onCreate={({ editor }) => {
              editorRef.current = editor;
              documentStore.updateEditor(editor);
            }}
            editable={!readOnly}
            className="w-full h-full border-muted sm:rounded-lg"
            editorProps={{
              handleDOMEvents: {
                keydown: (_view, event) => handleCommandNavigation(event),
              },
              handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
              handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved, uploadFn),
              attributes: {
                class: 'prose prose-md prose-headings:font-title font-default focus:outline-none max-w-full',
              },
            }}
            onUpdate={({ editor }) => {
              debouncedUpdates(editor);
              documentStore.updateDocumentSaveStatus('Unsaved');
            }}
            slotAfter={<ImageResizer />}
          >
            <CollabEditorCommand entityId={docId} entityType="document" />
            <CollabGenAIMenuSwitch
              contentSelector={{
                text: t('knowledgeBase.context.addToContext'),
                handleClick: () => handleAddToContext(selectedText),
              }}
            />
            <CollabGenAIBlockMenu />
          </EditorContent>
        </EditorRoot>
      </div>
      {contextHolder}
    </div>
  );
};

export const CanvasStatusBar = ({
  deckSize,
  setDeckSize,
}: {
  deckSize: number;
  setDeckSize: (size: number) => void;
}) => {
  const {
    currentDocument,
    updateCurrentDocument,
    documentServerStatus,
    documentCharsCount,
    documentSaveStatus,
    editor,
    tocItems,
  } = useDocumentStoreShallow((state) => ({
    currentDocument: state.currentDocument,
    updateCurrentDocument: state.updateCurrentDocument,
    documentServerStatus: state.documentServerStatus,
    documentCharsCount: state.documentCharsCount,
    documentSaveStatus: state.documentSaveStatus,
    editor: state.editor,
    tocItems: state.tocItems,
  }));
  const { handleDeleteTab } = useCanvasTabs();
  const { t } = useTranslation();

  const { createShare } = useHandleShare();
  const [shareLoading, setShareLoading] = useState(false);
  const handleShare = async () => {
    setShareLoading(true);
    await createShare({
      entityType: 'document',
      entityId: currentDocument?.docId,
      shareCode: currentDocument?.shareCode || undefined,
    });
    setShareLoading(false);
  };

  return (
    <div className="note-status-bar">
      <div className="note-status-bar-menu">
        {/* {canvasServerStatus === 'connected' ? (
          <div className="note-status-bar-item">
            <AiOutlineFileWord />
            <p className="conv-title">{t('knowledgeBase.note.noteCharsCount', { count: noteCharsCount })}</p>
          </div>
        ) : null} */}
        {documentServerStatus === 'connected' ? (
          <div className="note-status-bar-item">
            <HiOutlineClock />
            <p className="conv-title">
              {documentSaveStatus === 'Saved' ? t('knowledgeBase.note.autoSaved') : t('knowledgeBase.note.saving')}
            </p>
          </div>
        ) : null}

        {documentServerStatus === 'disconnected' ? (
          <div className="note-status-bar-item">
            <AiOutlineWarning />
            <p className="conv-title">{t('knowledgeBase.note.serviceDisconnected')}</p>
          </div>
        ) : null}
      </div>

      <div className="note-status-bar-menu">
        {/* <div className="note-status-bar-item" style={{ display: 'flex', alignItems: 'center' }}>
          <Popover
            content={
              <div className="sidebar">
                <div className="sidebar-options">
                  <div className="label-large">Table of contents</div>
                  <div className="table-of-contents">
                    <MemorizedToC editor={editor} items={tocItems} />
                  </div>
                </div>
              </div>
            }
          >
            <Button type="text" style={{ width: 32, height: 32 }} icon={<IconBook style={{ fontSize: 16 }} />} />
          </Popover>
          <Divider type="vertical" />
        </div> */}
        {/* <Button
          type="text"
          size="small"
          style={{ color: deckSize ? '#00968F' : '' }}
          icon={<IconQuote />}
          onClick={() => {
            setDeckSize(deckSize ? 0 : 200);
          }}
        ></Button> */}
        {/* <Divider type="vertical" /> */}
        {/* <Button
          type="text"
          size="small"
          style={{ color: currentDocument?.shareCode ? '#00968F' : '' }}
          loading={shareLoading}
          icon={<HiOutlineShare />}
          onClick={handleShare}
        >
          {currentDocument?.shareCode ? t('projectDetail.share.sharing') : t('common.share')}
        </Button>
        <Divider type="vertical" /> */}

        {currentDocument && documentServerStatus === 'connected' ? (
          <div
            className="note-status-bar-item"
            onClick={() => {
              updateCurrentDocument({ ...currentDocument, readOnly: !currentDocument?.readOnly });
              currentDocument?.readOnly
                ? message.success(t('knowledgeBase.note.edit'))
                : message.warning(t('knowledgeBase.note.readOnly'));
            }}
          >
            <Button
              type="text"
              style={{ width: 32, height: 32 }}
              icon={
                currentDocument?.readOnly ? <HiOutlineLockClosed style={{ color: '#00968F' }} /> : <HiOutlineLockOpen />
              }
            />
          </div>
        ) : null}

        <div className="note-status-bar-item">
          <Divider type="vertical" />
          <DeleteDropdownMenu
            type="document"
            canCopy={true}
            data={currentDocument}
            postDeleteList={(document: Document) => handleDeleteTab(document.docId)}
          />
        </div>
      </div>
    </div>
  );
};

export const DocumentEditorHeader = () => {
  const { currentDocument, updateCurrentDocument } = useDocumentStoreShallow((state) => ({
    currentDocument: state.currentDocument,
    updateCurrentDocument: state.updateCurrentDocument,
  }));

  const onTitleChange = (newTitle: string) => {
    const currentDocument = useDocumentStore.getState().currentDocument;

    if (!currentDocument) {
      return;
    }

    updateCurrentDocument({ ...currentDocument, title: newTitle });
  };

  useEffect(() => {
    editorEmitter.on('updateCanvasTitle', onTitleChange);

    return () => {
      editorEmitter.off('updateCanvasTitle', onTitleChange);
    };
  }, []);

  const title = currentDocument?.title;

  return (
    <div className="w-full">
      <div className="mx-0 mt-4 max-w-screen-lg">
        <Input
          className="text-3xl font-bold bg-transparent focus:border-transparent focus:bg-transparent"
          placeholder="Enter The Title"
          value={title}
          style={{ paddingLeft: 6 }}
          onChange={onTitleChange}
        />
      </div>
    </div>
  );
};

export const DocumentEditor = (props: { docId: string; deckSize: number; setDeckSize: (size: number) => void }) => {
  const { docId, deckSize, setDeckSize } = props;

  const { t } = useTranslation();

  const {
    currentDocument: document,
    isRequesting,
    documentServerStatus,
    updateCurrentDocument,
    updateIsRequesting,
    updateDocumentServerStatus,
    resetState,
  } = useDocumentStoreShallow((state) => ({
    currentDocument: state.currentDocument,
    isRequesting: state.isRequesting,
    newDocumentCreating: state.newDocumentCreating,
    documentServerStatus: state.documentServerStatus,
    updateCurrentDocument: state.updateCurrentDocument,
    updateIsRequesting: state.updateIsRequesting,
    updateDocumentServerStatus: state.updateDocumentServerStatus,
    resetState: state.resetState,
  }));
  const prevNote = useRef<Document>();

  useEffect(() => {
    return () => {
      resetState();
    };
  }, []);

  useEffect(() => {
    // updateCurrentCanvas(null);

    const fetchData = async () => {
      updateIsRequesting(true);
      const { data } = await getClient().getDocumentDetail({
        query: { docId },
      });
      const document = data?.data;
      if (document) {
        updateCurrentDocument(document);
        updateIsRequesting(false);
      }
    };
    if (docId && document?.docId !== docId) {
      fetchData();
    }

    return () => {
      updateIsRequesting(false);
    };
  }, [docId, document?.docId]);

  const debouncedUpdateDocument = useDebouncedCallback(async (document: Document) => {
    const res = await getClient().updateDocument({
      body: {
        docId: document.docId,
        title: document.title,
        readOnly: document.readOnly,
      },
    });
    if (res.error) {
      console.error(res.error);
      return;
    }
  }, 500);

  useEffect(() => {
    if (document && prevNote.current?.docId === document.docId) {
      debouncedUpdateDocument(document);
    }
    prevNote.current = document;
  }, [document, debouncedUpdateDocument]);

  return (
    <DocumentProvider docId={docId}>
      <div className="flex flex-col ai-note-container">
        <CanvasStatusBar deckSize={deckSize} setDeckSize={setDeckSize} />
        <div className="overflow-auto flex-grow">
          <Spin
            className="document-editor-spin"
            tip={t('knowledgeBase.note.connecting')}
            loading={!document || isRequesting || documentServerStatus !== 'connected'}
            style={{ height: '100%', width: '100%' }}
          >
            <div className="ai-note-editor">
              <div className="ai-note-editor-container">
                <DocumentEditorHeader />
                <CollaborativeEditor docId={docId} />
              </div>
            </div>
          </Spin>
        </div>
      </div>
    </DocumentProvider>
  );
};
