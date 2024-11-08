import { memo, useEffect, useMemo, useRef, useState } from 'react';
import wordsCount from 'words-count';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Canvas } from '@refly/openapi-schema';

import './index.scss';
import { useCookie } from 'react-use';
import { Input, Popover, Spin } from '@arco-design/web-react';
import { HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineClock, HiOutlineShare } from 'react-icons/hi2';
import { IconQuote } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { editorEmitter } from '@refly-packages/utils/event-emitter/editor';

import {
  CollabEditorCommand,
  CollabGenAIMenuSwitch,
  CollabGenAIBlockMenu,
} from '@refly-packages/editor-component/advanced-editor';
import { EditorRoot } from '@refly-packages/editor-core/components';
import { EditorContent, EditorInstance } from '@refly-packages/editor-core/components';
import { DeleteDropdownMenu } from '@refly-packages/ai-workspace-common/components/project-detail/delete-dropdown-menu';
import { configureHighlightJs, ImageResizer, handleCommandNavigation } from '@refly-packages/editor-core/extensions';
import { defaultExtensions, Placeholder } from '@refly-packages/editor-component/extensions';
import { createUploadFn } from '@refly-packages/editor-component/image-upload';
import { configureSlashCommand } from '@refly-packages/editor-component/slash-command';
import { HocuspocusProvider } from '@hocuspocus/provider';
import Collaboration from '@tiptap/extension-collaboration';
import { useDebouncedCallback } from 'use-debounce';
import { handleImageDrop, handleImagePaste } from '@refly-packages/editor-core/plugins';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { getHierarchicalIndexes, TableOfContents } from '@tiptap-pro/extension-table-of-contents';

import { AiOutlineWarning, AiOutlineFileWord } from 'react-icons/ai';
import { getClientOrigin, getWsServerOrigin } from '@refly-packages/utils/url';
import { useCanvasStore, useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useCanvasTabs } from '@refly-packages/ai-workspace-common/hooks/use-canvas-tabs';

// content selector
import { useContentSelector } from '@refly-packages/ai-workspace-common/modules/content-selector/hooks/use-content-selector';
import '@refly-packages/ai-workspace-common/modules/content-selector/styles/content-selector.scss';
import classNames from 'classnames';
import { useContentSelectorStoreShallow } from '@refly-packages/ai-workspace-common/modules/content-selector/stores/content-selector';
import { useContextPanelStoreShallow } from '@refly-packages/ai-workspace-common/stores/context-panel';
// componets
import { ToC } from './ToC';
import { IconBook } from '@arco-design/web-react/icon';
import { useProjectTabs } from '@refly-packages/ai-workspace-common/hooks/use-project-tabs';
import { Button, Divider, message } from 'antd';
import { useProjectStore, useProjectStoreShallow } from '@refly-packages/ai-workspace-common/stores/project';
import { useHandleShare } from '@refly-packages/ai-workspace-common/hooks/use-handle-share';
import { useReferencesStoreShallow } from '@refly-packages/ai-workspace-common/stores/references';
import { useEditorStore, useEditorStoreShallow } from '@refly-packages/ai-workspace-common/stores/editor';

const MemorizedToC = memo(ToC);

const CollaborativeEditor = ({ projectId, canvasId }: { projectId: string; canvasId: string }) => {
  const { t } = useTranslation();
  const lastCursorPosRef = useRef<number>();
  const [token] = useCookie('_refly_ai_sid');

  const canvasStore = useCanvasStoreShallow((state) => ({
    currentCanvas: state.currentCanvas,
    canvasServerStatus: state.canvasServerStatus,
    updateCurrentCanvas: state.updateCurrentCanvas,
    updateCanvasCharsCount: state.updateCanvasCharsCount,
    updateCanvasSaveStatus: state.updateCanvasSaveStatus,
    updateCanvasServerStatus: state.updateCanvasServerStatus,
    updateTocItems: state.updateTocItems,
    updateLastCursorPosRef: state.updateLastCursorPosRef,
  }));

  const contextPanelStore = useContextPanelStoreShallow((state) => ({
    updateBeforeSelectionNoteContent: state.updateBeforeSelectionNoteContent,
    updateAfterSelectionNoteContent: state.updateAfterSelectionNoteContent,
    updateCurrentSelectionContent: state.updateCurrentSelectionContent,
  }));

  const { editorMap, setEditor, updateEditor, deleteEditor } = useEditorStoreShallow((state) => ({
    editorMap: state.editorMap,
    setEditor: state.setEditor,
    updateEditor: state.updateEditor,
    deleteEditor: state.deleteEditor,
  }));
  const editorData = editorMap[canvasId];
  const editor = editorData?.instance;

  const { showContentSelector, scope } = useContentSelectorStoreShallow((state) => ({
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

  // initial block selection
  const baseUrl = getClientOrigin();
  const { initContentSelectorElem, addInlineMarkForNote } = useContentSelector(
    'ai-note-editor-content-container',
    'canvasSelection',
    {
      url: `${baseUrl}/project/${projectId}?canvasId=${canvasId}`,
    },
  );

  const websocketProvider = useMemo(() => {
    const provider = new HocuspocusProvider({
      url: getWsServerOrigin(),
      name: canvasId,
      token,
    });
    provider.on('status', (event) => {
      canvasStore.updateCanvasServerStatus(event.status);
    });

    // Add synced event listener
    provider.on('synced', () => {
      editorEmitter.emit('editorSynced');
    });
    return provider;
  }, [canvasId]);

  const uploadFn = useMemo(() => createUploadFn({ entityId: canvasId, entityType: 'canvas' }), [canvasId]);
  const slashCommand = useMemo(
    () =>
      configureSlashCommand({
        entityId: canvasId,
        entityType: 'canvas',
      }),
    [canvasId],
  );

  const extensions = [
    ...defaultExtensions,
    slashCommand,
    createPlaceholderExtension(),
    Collaboration.configure({
      document: websocketProvider.document,
    }),
    CollaborationCursor.configure({
      provider: websocketProvider,
    }),
    TableOfContents.configure({
      getIndex: getHierarchicalIndexes,
      onUpdate(content) {
        canvasStore.updateTocItems(content);
      },
    }),
  ];

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

  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    const json = editor.getJSON();
    const markdown = editor.storage.markdown.getMarkdown();
    canvasStore.updateCanvasCharsCount(wordsCount(markdown));
    window.localStorage.setItem('html-content', await highlightCodeblocks(editor.getHTML()));
    window.localStorage.setItem('novel-content', JSON.stringify(json));
    window.localStorage.setItem('markdown', editor.storage.markdown.getMarkdown());
    canvasStore.updateCanvasSaveStatus('Saved');
  }, 500);

  const handleContentSelectorClick = () => {
    addInlineMarkForNote();
  };

  useEffect(() => {
    return () => {
      const editor = useEditorStore.getState().editorMap[canvasId];
      if (!editor?.isAiEditing) {
        deleteEditor(canvasId);
      } else {
        updateEditor(canvasId, { pendingDelete: true });
      }
    };
  }, [canvasId]);

  const readOnly = canvasStore?.currentCanvas?.readOnly ?? false;

  useEffect(() => {
    if (editor && !readOnly) {
      editor.on('blur', () => {
        updateEditor(canvasId, { lastCursorPos: editor.view?.state?.selection?.$head?.pos });

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

        canvasStore.updateLastCursorPosRef(lastCursorPosRef.current);
        contextPanelStore.updateCurrentSelectionContent(selectedContent);
        contextPanelStore.updateBeforeSelectionNoteContent(prevSelectionContent);
        contextPanelStore.updateAfterSelectionNoteContent(afterSelectionContent);
      });
    }
  }, [editor, readOnly]);

  useEffect(() => {
    if (editor) {
      if (readOnly) {
        // ensure we sync the content just before setting the editor to readonly
        websocketProvider.forceSync();
      }
      editor.setOptions({ editable: !readOnly });
    }
  }, [readOnly]);

  return (
    <div
      className={classNames('w-full', 'ai-note-editor-content-container', {
        'refly-selector-mode-active': showContentSelector,
        'refly-block-selector-mode': scope === 'block',
        'refly-inline-selector-mode': scope === 'inline',
      })}
    >
      {initContentSelectorElem()}
      <div className="w-full h-full">
        <EditorRoot>
          <EditorContent
            extensions={extensions}
            onCreate={({ editor }) => {
              setEditor(canvasId, { instance: editor, wsProvider: websocketProvider });
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
              canvasStore.updateCanvasSaveStatus('Unsaved');
            }}
            slotAfter={<ImageResizer />}
          >
            <CollabEditorCommand entityId={canvasId} entityType="note" />
            <CollabGenAIMenuSwitch
              contentSelector={{
                text: t('knowledgeBase.context.addToContext'),
                handleClick: handleContentSelectorClick,
              }}
            />
            <CollabGenAIBlockMenu />
          </EditorContent>
        </EditorRoot>
      </div>
    </div>
  );
};

export const CanvasStatusBar = () => {
  const { currentCanvas, updateCurrentCanvas, canvasServerStatus, noteSaveStatus, tocItems } = useCanvasStoreShallow(
    (state) => ({
      currentCanvas: state.currentCanvas,
      updateCurrentCanvas: state.updateCurrentCanvas,
      canvasServerStatus: state.canvasServerStatus,
      noteCharsCount: state.canvasCharsCount,
      noteSaveStatus: state.canvasSaveStatus,
      tocItems: state.tocItems,
    }),
  );
  const { handleDeleteTab } = useCanvasTabs();
  const { t } = useTranslation();
  const { deckSize, setDeckSize } = useReferencesStoreShallow((state) => ({
    deckSize: state.deckSize,
    setDeckSize: state.setDeckSize,
  }));

  const { createShare } = useHandleShare();
  const [shareLoading, setShareLoading] = useState(false);
  const handleShare = async () => {
    setShareLoading(true);
    await createShare({
      entityType: 'canvas',
      entityId: currentCanvas?.canvasId,
      shareCode: currentCanvas?.shareCode || undefined,
    });
    setShareLoading(false);
  };
  const editor = useEditorStoreShallow((state) => state.editorMap[currentCanvas?.canvasId]);

  return (
    <div className="note-status-bar">
      <div className="note-status-bar-menu">
        {/* {canvasServerStatus === 'connected' ? (
          <div className="note-status-bar-item">
            <AiOutlineFileWord />
            <p className="conv-title">{t('knowledgeBase.note.noteCharsCount', { count: noteCharsCount })}</p>
          </div>
        ) : null} */}
        {canvasServerStatus === 'connected' ? (
          <div className="note-status-bar-item">
            <HiOutlineClock />
            <p className="conv-title">
              {noteSaveStatus === 'Saved' ? t('knowledgeBase.note.autoSaved') : t('knowledgeBase.note.saving')}
            </p>
          </div>
        ) : null}

        {canvasServerStatus === 'disconnected' ? (
          <div className="note-status-bar-item">
            <AiOutlineWarning />
            <p className="conv-title">{t('knowledgeBase.note.serviceDisconnected')}</p>
          </div>
        ) : null}
      </div>

      <div className="note-status-bar-menu">
        <div className="note-status-bar-item" style={{ display: 'flex', alignItems: 'center' }}>
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
        </div>
        <Button
          type="text"
          size="small"
          style={{ color: deckSize ? '#00968F' : '' }}
          icon={<IconQuote />}
          onClick={() => {
            setDeckSize(deckSize ? 0 : 300);
          }}
        ></Button>
        <Divider type="vertical" />
        <Button
          type="text"
          size="small"
          style={{ color: currentCanvas?.shareCode ? '#00968F' : '' }}
          loading={shareLoading}
          icon={<HiOutlineShare />}
          onClick={handleShare}
        >
          {currentCanvas?.shareCode ? t('projectDetail.share.sharing') : t('common.share')}
        </Button>
        <Divider type="vertical" />

        {currentCanvas && canvasServerStatus === 'connected' ? (
          <div
            className="note-status-bar-item"
            onClick={() => {
              updateCurrentCanvas({ ...currentCanvas, readOnly: !currentCanvas?.readOnly });
              currentCanvas?.readOnly
                ? message.success(t('knowledgeBase.note.edit'))
                : message.warning(t('knowledgeBase.note.readOnly'));
            }}
          >
            <Button
              type="text"
              style={{ width: 32, height: 32 }}
              icon={
                currentCanvas?.readOnly ? <HiOutlineLockClosed style={{ color: '#00968F' }} /> : <HiOutlineLockOpen />
              }
            />
          </div>
        ) : null}
        <div className="note-status-bar-item">
          <Divider type="vertical" />
          <DeleteDropdownMenu
            type="canvas"
            canCopy={true}
            data={currentCanvas}
            postDeleteList={(canvas: Canvas) => handleDeleteTab(canvas.canvasId)}
          />
        </div>
      </div>
    </div>
  );
};

export const CanvasEditorHeader = (props: { projectId: string; canvasId: string }) => {
  const { projectId, canvasId } = props;
  const { currentCanvas, updateCurrentCanvas } = useCanvasStoreShallow((state) => ({
    currentCanvas: state.currentCanvas,
    updateCurrentCanvas: state.updateCurrentCanvas,
  }));
  const { updateProjectDirItem } = useProjectStoreShallow((state) => ({
    updateProjectDirItem: state.updateProjectDirItem,
  }));
  const { tabsMap, handleUpdateTab } = useProjectTabs();
  const tab = tabsMap[projectId]?.find((tab) => tab.key === canvasId);

  const onTitleChange = (newTitle: string) => {
    const currentCanvas = useCanvasStore.getState().currentCanvas;
    const tabsMap = useProjectStore.getState().projectTabs;

    if (!currentCanvas) {
      return;
    }

    updateCurrentCanvas({ ...currentCanvas, title: newTitle });
    updateProjectDirItem(projectId, 'canvases', currentCanvas.canvasId, { title: newTitle });

    const tab = tabsMap[projectId]?.find((tab) => tab.key === currentCanvas.canvasId);

    if (tab) {
      handleUpdateTab(projectId, currentCanvas.canvasId, {
        ...tab,
        title: newTitle,
      });
    }
  };

  useEffect(() => {
    editorEmitter.on('updateCanvasTitle', onTitleChange);

    return () => {
      editorEmitter.off('updateCanvasTitle', onTitleChange);
    };
  }, []);

  const title = currentCanvas?.title || tab?.title;

  return (
    <div className="w-full">
      <div className="mx-2 mt-4 max-w-screen-lg">
        <Input
          className="text-3xl font-bold bg-transparent focus:border-transparent focus:bg-transparent"
          placeholder="Enter The Title"
          value={title}
          onChange={onTitleChange}
        />
      </div>
    </div>
  );
};

export const CanvasEditor = (props: { projectId: string; canvasId: string }) => {
  const { projectId, canvasId } = props;

  const { t } = useTranslation();

  const {
    currentCanvas: canvas,
    isRequesting,
    canvasServerStatus,
    updateCurrentCanvas,
    updateIsRequesting,
    resetState,
  } = useCanvasStoreShallow((state) => ({
    currentCanvas: state.currentCanvas,
    isRequesting: state.isRequesting,
    newNoteCreating: state.newCanvasCreating,
    canvasServerStatus: state.canvasServerStatus,
    updateCurrentCanvas: state.updateCurrentCanvas,
    updateIsRequesting: state.updateIsRequesting,
    updateCanvasServerStatus: state.updateCanvasServerStatus,
    resetState: state.resetState,
  }));
  const prevNote = useRef<Canvas>();

  useEffect(() => {
    return () => {
      resetState();
    };
  }, []);

  useEffect(() => {
    // updateCurrentCanvas(null);

    const fetchData = async () => {
      updateIsRequesting(true);
      const { data } = await getClient().getCanvasDetail({
        query: { canvasId },
      });
      const canvas = data?.data;
      if (canvas) {
        updateCurrentCanvas(canvas);
        updateIsRequesting(false);
      }
    };
    if (canvasId && canvas?.canvasId !== canvasId) {
      fetchData();
    }

    return () => {
      updateIsRequesting(false);
    };
  }, [canvasId, canvas?.canvasId]);

  const debouncedUpdateCanvas = useDebouncedCallback(async (canvas: Canvas) => {
    const res = await getClient().updateCanvas({
      body: {
        canvasId: canvas.canvasId,
        title: canvas.title,
        readOnly: canvas.readOnly,
      },
    });
    if (res.error) {
      console.error(res.error);
      return;
    }
  }, 500);

  useEffect(() => {
    if (canvas && prevNote.current?.canvasId === canvas.canvasId) {
      debouncedUpdateCanvas(canvas);
    }
    prevNote.current = canvas;
  }, [canvas, debouncedUpdateCanvas]);

  return (
    <div className="flex flex-col ai-note-container">
      <CanvasStatusBar />
      <div className="overflow-auto flex-grow">
        <Spin
          tip={t('knowledgeBase.note.connecting')}
          loading={!canvas || isRequesting || canvasServerStatus !== 'connected'}
          style={{ height: '100%', width: '100%' }}
        >
          <div className="ai-note-editor">
            <div className="ai-note-editor-container">
              <CanvasEditorHeader projectId={projectId} canvasId={canvasId} />
              <CollaborativeEditor projectId={projectId} canvasId={canvasId} />
            </div>
          </div>
        </Spin>
      </div>
    </div>
  );
};
