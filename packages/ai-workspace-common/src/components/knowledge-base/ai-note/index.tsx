import { memo, useEffect, useMemo, useRef, useState } from 'react';
import wordsCount from 'words-count';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Note } from '@refly/openapi-schema';

import './index.scss';
import { useCookie } from 'react-use';
import { Button, Divider, Input, Popover, Spin, Switch, Tabs, Tooltip } from '@arco-design/web-react';
import { HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineClock } from 'react-icons/hi2';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { editorEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/editor';

import {
  CollabEditorCommand,
  CollabGenAIMenuSwitch,
  CollabGenAIBlockMenu,
} from '@refly-packages/editor-component/advanced-editor';
import { EditorRoot } from '@refly-packages/editor-core/components';
import { EditorContent, EditorInstance } from '@refly-packages/editor-core/components';
import { DeleteDropdownMenu } from '@refly-packages/ai-workspace-common/components/knowledge-base/delete-dropdown-menu';
import { configureHighlightJs, ImageResizer, handleCommandNavigation } from '@refly-packages/editor-core/extensions';
import { defaultExtensions } from '@refly-packages/editor-component/extensions';
import { createUploadFn } from '@refly-packages/editor-component/image-upload';
import { configureSlashCommand } from '@refly-packages/editor-component/slash-command';
import { HocuspocusProvider } from '@hocuspocus/provider';
import Collaboration from '@tiptap/extension-collaboration';
import { useDebouncedCallback } from 'use-debounce';
import { handleImageDrop, handleImagePaste } from '@refly-packages/editor-core/plugins';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { getHierarchicalIndexes, TableOfContents } from '@tiptap-pro/extension-table-of-contents';

import { AiOutlineWarning, AiOutlineFileWord, AiOutlineDisconnect } from 'react-icons/ai';
import { useSearchStore } from '@refly-packages/ai-workspace-common/stores/search';
import { getClientOrigin, getWsServerOrigin } from '@refly-packages/utils/url';
import { useNoteStore } from '@refly-packages/ai-workspace-common/stores/note';
import { useNoteTabs } from '@refly-packages/ai-workspace-common/hooks/use-note-tabs';
import { useAINote } from '@refly-packages/ai-workspace-common/hooks/use-ai-note';
import { AINoteEmpty } from '@refly-packages/ai-workspace-common/components/knowledge-base/ai-note-empty';

// content selector
import { useContentSelector } from '@refly-packages/ai-workspace-common/modules/content-selector/hooks/use-content-selector';
import '@refly-packages/ai-workspace-common/modules/content-selector/styles/content-selector.scss';
import classNames from 'classnames';
import { useContentSelectorStore } from '@refly-packages/ai-workspace-common/modules/content-selector/stores/content-selector';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
// componets
import { ToC } from './ToC';
import { IconBook, IconLoading, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { CopilotOperationModule } from '@refly-packages/ai-workspace-common/components/knowledge-base/copilot/copilot-operation-module';

const MemorizedToC = memo(ToC);

const CollaborativeEditor = ({ noteId }: { noteId: string }) => {
  const { t } = useTranslation();
  const lastCursorPosRef = useRef<number>();
  const [token] = useCookie('_refly_ai_sid');

  const noteStore = useNoteStore((state) => ({
    currentNote: state.currentNote,
    noteServerStatus: state.noteServerStatus,
    updateCurrentNote: state.updateCurrentNote,
    updateNoteCharsCount: state.updateNoteCharsCount,
    updateNoteSaveStatus: state.updateNoteSaveStatus,
    updateNoteServerStatus: state.updateNoteServerStatus,
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

  // initial block selection
  const baseUrl = getClientOrigin();
  const { initContentSelectorElem, addInlineMarkForNote } = useContentSelector(
    'ai-note-editor-content-container',
    'noteSelection',
    {
      url: `${baseUrl}/knowledge-base?noteId=${noteId}`,
    },
  );

  const websocketProvider = useMemo(() => {
    return new HocuspocusProvider({
      url: getWsServerOrigin(),
      name: noteId,
      token,
    });
  }, [noteId]);

  const uploadFn = useMemo(() => createUploadFn({ entityId: noteId, entityType: 'note' }), [noteId]);
  const slashCommand = useMemo(
    () =>
      configureSlashCommand({
        entityId: noteId,
        entityType: 'note',
      }),
    [noteId],
  );

  const extensions = [
    ...defaultExtensions,
    slashCommand,
    Collaboration.configure({
      document: websocketProvider.document,
    }),
    CollaborationCursor.configure({
      provider: websocketProvider,
    }),
    TableOfContents.configure({
      getIndex: getHierarchicalIndexes,
      onUpdate(content) {
        noteStore.updateTocItems(content);
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
    noteStore.updateNoteCharsCount(wordsCount(markdown));
    window.localStorage.setItem('html-content', await highlightCodeblocks(editor.getHTML()));
    window.localStorage.setItem('novel-content', JSON.stringify(json));
    window.localStorage.setItem('markdown', editor.storage.markdown.getMarkdown());
    noteStore.updateNoteSaveStatus('Saved');
  }, 500);

  const handleContentSelectorClick = () => {
    addInlineMarkForNote();
  };

  useEffect(() => {
    // Update status changes
    websocketProvider.on('status', (event) => {
      noteStore.updateNoteServerStatus(event.status);
    });

    return () => {
      websocketProvider.forceSync();
      websocketProvider.destroy();
      editorRef.current?.destroy();
    };
  }, []);

  const readOnly = noteStore?.currentNote?.readOnly ?? false;

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

        noteStore.updateLastCursorPosRef(lastCursorPosRef.current);
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
        websocketProvider.forceSync();
      }
      editorRef.current.setOptions({ editable: !readOnly });
    }
  }, [readOnly]);

  const copilotOperationModuleRef = useRef<HTMLDivElement>(null);

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
              editorRef.current = editor;
              noteStore.updateEditor(editor);
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
              noteStore.updateNoteSaveStatus('Unsaved');
            }}
            slotAfter={<ImageResizer />}
          >
            <CollabEditorCommand entityId={noteId} entityType="note" />
            <CollabGenAIMenuSwitch
              contentSelector={{
                text: t('knowledgeBase.context.addToContext'),
                handleClick: handleContentSelectorClick,
              }}
              copilotOperationModule={
                <div>
                  <CopilotOperationModule />
                </div>
              }
            />
            <CollabGenAIBlockMenu />
          </EditorContent>
        </EditorRoot>
      </div>
    </div>
  );
};

interface AINoteStatusBarProps {}

export const AINoteStatusBar = (props: AINoteStatusBarProps) => {
  const { currentNote, updateCurrentNote, noteServerStatus, noteCharsCount, noteSaveStatus, editor, tocItems } =
    useNoteStore((state) => ({
      currentNote: state.currentNote,
      updateCurrentNote: state.updateCurrentNote,
      noteServerStatus: state.noteServerStatus,
      noteCharsCount: state.noteCharsCount,
      noteSaveStatus: state.noteSaveStatus,
      editor: state.editor,
      tocItems: state.tocItems,
    }));
  const { handleDeleteTab } = useNoteTabs();
  const { t } = useTranslation();

  return (
    <div className="note-status-bar">
      <div className="note-status-bar-menu">
        {noteServerStatus === 'connected' ? (
          <div className="note-status-bar-item">
            <AiOutlineFileWord />
            <p className="conv-title">{t('knowledgeBase.note.noteCharsCount', { count: noteCharsCount })}</p>
          </div>
        ) : null}
        {noteServerStatus === 'disconnected' ? (
          <div className="note-status-bar-item">
            <AiOutlineWarning />
            <p className="conv-title">{t('knowledgeBase.note.serviceDisconnected')}</p>
          </div>
        ) : null}
        {noteServerStatus === 'connected' ? (
          <div className="note-status-bar-item">
            <Divider type="vertical" />
            <HiOutlineClock />
            <p className="conv-title">
              {noteSaveStatus === 'Saved' ? t('knowledgeBase.note.autoSaved') : t('knowledgeBase.note.saving')}
            </p>
          </div>
        ) : null}
      </div>
      <div className="note-status-bar-menu">
        <div className="note-status-bar-item" style={{ display: 'flex', alignItems: 'center', marginRight: 10 }}>
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
            <IconBook style={{ fontSize: 16 }} />
          </Popover>
          <Divider type="vertical" />
        </div>
        {currentNote && noteServerStatus === 'connected' ? (
          <div className="note-status-bar-item">
            {currentNote?.readOnly ? <HiOutlineLockClosed /> : <HiOutlineLockOpen />}
            <p className="mr-2 conv-title">
              {currentNote?.readOnly ? t('knowledgeBase.note.readOnly') : t('knowledgeBase.note.edit')}
            </p>
            <Switch
              type="round"
              size="small"
              checked={currentNote?.readOnly}
              onChange={(readOnly) => updateCurrentNote({ ...currentNote, readOnly })}
            />
          </div>
        ) : null}
        <div className="note-status-bar-item">
          <Divider type="vertical" />
          <DeleteDropdownMenu
            type="note"
            canCopy={true}
            data={currentNote}
            postDeleteList={(note: Note) => handleDeleteTab(note.noteId)}
          />
        </div>
      </div>
    </div>
  );
};

interface AINoteHeaderProps {}

export const AINoteHeader = (props: AINoteHeaderProps) => {
  const { currentNote, updateCurrentNote, tabs, activeTab } = useNoteStore((state) => ({
    tabs: state.tabs,
    activeTab: state.activeTab,
    currentNote: state.currentNote,
    updateCurrentNote: state.updateCurrentNote,
  }));
  const { handleUpdateTabTitle } = useNoteTabs();

  const onTitleChange = (newTitle: string) => {
    updateCurrentNote({ ...currentNote, title: newTitle });
    handleUpdateTabTitle(currentNote.noteId, newTitle);
  };

  const title = tabs.find((tab) => tab.key === activeTab)?.title || currentNote?.title;

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

export const AINote = () => {
  const [searchParams] = useSearchParams();
  const noteId = searchParams.get('noteId');

  const { t } = useTranslation();

  const { handleInitEmptyNote } = useAINote();
  const {
    currentNote: note,
    isRequesting,
    newNoteCreating,
    noteServerStatus,
    updateCurrentNote,
    updateIsRequesting,
    updateNotePanelVisible,
    updateNoteServerStatus,
    resetState,
  } = useNoteStore((state) => ({
    currentNote: state.currentNote,
    isRequesting: state.isRequesting,
    newNoteCreating: state.newNoteCreating,
    noteServerStatus: state.noteServerStatus,
    updateCurrentNote: state.updateCurrentNote,
    updateIsRequesting: state.updateIsRequesting,
    updateNotePanelVisible: state.updateNotePanelVisible,
    updateNoteServerStatus: state.updateNoteServerStatus,
    resetState: state.resetState,
  }));
  const prevNote = useRef<Note>();

  const searchStore = useSearchStore();

  const { tabs, activeTab, setActiveTab, handleDeleteTab, handleAddTab } = useNoteTabs();

  useEffect(() => {
    return () => {
      resetState();
    };
  }, []);

  useEffect(() => {
    updateCurrentNote(null);
    updateNotePanelVisible(true);
    updateNoteServerStatus('disconnected');

    const fetchData = async () => {
      updateIsRequesting(true);
      const { data } = await getClient().getNoteDetail({
        query: { noteId },
      });
      const note = data?.data;
      if (note) {
        updateCurrentNote(note);
        updateIsRequesting(false);
      }
      if (!tabs.some((tab) => tab.key === noteId)) {
        handleAddTab({
          title: note.title,
          key: note.noteId,
          content: note.contentPreview || '',
          noteId: note.noteId,
        });
      }
    };
    if (noteId) {
      fetchData();
    }

    return () => {
      updateIsRequesting(false);
      updateNotePanelVisible(false);
    };
  }, [noteId]);

  const debouncedUpdateNote = useDebouncedCallback(async (note: Note) => {
    const res = await getClient().updateNote({
      body: {
        noteId: note.noteId,
        title: note.title,
        readOnly: note.readOnly,
        isPublic: note.isPublic,
      },
    });
    if (res.error) {
      console.error(res.error);
      return;
    }
  }, 500);

  useEffect(() => {
    if (note && prevNote.current?.noteId === note.noteId) {
      debouncedUpdateNote(note);
    }
    prevNote.current = note;
  }, [note, debouncedUpdateNote]);

  if (noteId === undefined || noteId == null || noteId === '') {
    return <AINoteEmpty />;
  }

  return (
    <div className="ai-note-container">
      <Tabs
        editable
        addButton={
          <Button
            type="text"
            size="small"
            shape="circle"
            disabled={newNoteCreating}
            icon={newNoteCreating ? <IconLoading /> : <IconPlus />}
          />
        }
        type="card-gutter"
        className="note-detail-tab-container"
        activeTab={activeTab}
        onDeleteTab={handleDeleteTab}
        onAddTab={() => handleInitEmptyNote('')}
        onChange={setActiveTab}
        renderTabHeader={(props, DefaultTabHeader) => {
          return (
            <div className="note-detail-header">
              <div className="note-detail-nav-switcher">
                <DefaultTabHeader {...props} />
              </div>
              <div className="note-detail-navigation-bar">
                <Tooltip content={t('knowledgeBase.header.searchOrOpenNote')} getPopupContainer={getPopupContainer}>
                  <Button
                    icon={<IconSearch />}
                    type="text"
                    style={{ marginRight: 4 }}
                    className="assist-action-item-header"
                    onClick={() => {
                      searchStore.setPages(searchStore.pages.concat('note'));
                      searchStore.setIsSearchOpen(true);
                    }}
                  ></Button>
                </Tooltip>
              </div>
            </div>
          );
        }}
      >
        {tabs.map((tab, i) => (
          <Tabs.TabPane destroyOnHide key={tab.key} title={tab.title}>
            <div></div>
          </Tabs.TabPane>
        ))}
      </Tabs>
      <Spin
        tip={t('knowledgeBase.note.connecting')}
        loading={!note || isRequesting || noteServerStatus !== 'connected'}
        style={{ height: '100%', width: '100%' }}
      >
        <div className="ai-note-editor">
          <div className="ai-note-editor-container">
            <AINoteHeader />
            <CollaborativeEditor key={noteId} noteId={noteId} />
          </div>
        </div>
      </Spin>
      <AINoteStatusBar />
    </div>
  );
};
