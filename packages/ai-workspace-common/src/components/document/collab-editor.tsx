import { useEffect, useMemo, useRef, memo, useCallback } from 'react';
import { useThrottledCallback } from 'use-debounce';
import classNames from 'classnames';
import wordsCount from 'words-count';
import { useTranslation } from 'react-i18next';
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
import {
  handleImageDrop,
  handleImagePaste,
} from '@refly-packages/ai-workspace-common/components/editor/core/plugins';
import { getHierarchicalIndexes, TableOfContents } from '@tiptap-pro/extension-table-of-contents';
import {
  useDocumentStore,
  useDocumentStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/document';

import { genUniqueId } from '@refly-packages/utils/id';
import { useSelectionContext } from '@refly-packages/ai-workspace-common/modules/selection-menu/use-selection-context';
import { useDocumentContext } from '@refly-packages/ai-workspace-common/context/document';
import { editorEmitter } from '@refly-packages/utils/event-emitter/editor';
import { useEditorPerformance } from '@refly-packages/ai-workspace-common/context/editor-performance';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useCreateMemo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-memo';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { Markdown } from 'tiptap-markdown';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { ColorMarkdownExtension } from '@refly-packages/ai-workspace-common/utils/colorMarkdownExtentions';

export const CollaborativeEditor = memo(
  ({ docId }: { docId: string }) => {
    const { t } = useTranslation();
    const lastCursorPosRef = useRef<number>();
    const { isNodeDragging } = useEditorPerformance();
    const editorRef = useRef<EditorInstance>();
    const { provider, ydoc } = useDocumentContext();
    const forceUpdateRef = useRef<number>(0);

    // Move hooks to top level
    const documentActions = useDocumentStoreShallow((state) => ({
      setHasEditorSelection: state.setHasEditorSelection,
      updateDocumentCharsCount: state.updateDocumentCharsCount,
      updateTocItems: state.updateTocItems,
      updateLastCursorPosRef: state.updateLastCursorPosRef,
      setActiveDocumentId: state.setActiveDocumentId,
    }));

    const { readOnly } = useDocumentStoreShallow((state) => ({
      readOnly: state.config[docId]?.readOnly,
    }));

    const setNodeDataByEntity = useSetNodeDataByEntity();

    // Memoize the update function to prevent unnecessary re-renders
    const handleEditorUpdate = useCallback(
      (editor: EditorInstance) => {
        if (isNodeDragging || !provider?.status || provider.status !== 'connected') {
          return;
        }

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

        documentActions.updateDocumentCharsCount(docId, wordsCount(markdown));
      },
      [docId, isNodeDragging, provider?.status, setNodeDataByEntity, documentActions],
    );

    // Use throttle with memoized function
    const debouncedUpdates = useThrottledCallback(handleEditorUpdate, 300, { leading: true });

    // Define createPlaceholderExtension before using it
    const createPlaceholderExtension = useCallback(() => {
      return Placeholder.configure({
        placeholder: ({ node }) => {
          const defaultPlaceholder = t('editor.placeholder.default', {
            defaultValue: "Press 'space' for AI, '/' for commands",
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
    }, [t]);

    // Memoize expensive computations
    const uploadFn = useMemo(
      () => createUploadFn({ entityId: docId, entityType: 'document' }),
      [docId],
    );

    const extensions = useMemo(
      () => [
        ...defaultExtensions,
        configureSlashCommand({
          entityId: docId,
          entityType: 'document',
        }),
        createPlaceholderExtension(),
        TextStyle,
        Color.configure({
          types: ['textStyle'],
        }),
        ColorMarkdownExtension,
        Markdown.configure({
          html: true,
          transformCopiedText: true,
          transformPastedText: true,
          breaks: true,
          tightLists: true,
          tightListClass: 'tight',
          bulletListMarker: '-',
          linkify: true,
        }),
        Collaboration.configure({
          document: ydoc,
        }),
        TableOfContents.configure({
          getIndex: getHierarchicalIndexes,
          onUpdate(content) {
            documentActions.updateTocItems(docId, content);
          },
        }),
      ],
      [ydoc, docId, documentActions, createPlaceholderExtension],
    );

    const { addToContext, selectedText } = useSelectionContext({
      containerClass: 'ai-note-editor-content-container',
    });

    const buildContextItem = (text: string): IContextItem => {
      const { document } = useDocumentStore.getState()?.data?.[docId] ?? {};

      return {
        title: text.slice(0, 50),
        entityId: genUniqueId(),
        type: 'documentSelection',
        selection: {
          content: text,
          sourceTitle: document?.title ?? 'Selected Content',
          sourceEntityId: document?.docId ?? '',
          sourceEntityType: 'document',
        },
      };
    };

    const handleAddToContext = (text: string) => {
      const item = buildContextItem(text);
      addToContext(item);
    };

    const { createMemo } = useCreateMemo();
    const handleCreateMemo = useCallback(
      (selectedText: string) => {
        createMemo({
          content: selectedText,
          sourceNode: {
            type: 'document',
            entityId: docId,
          },
        });
      },
      [docId],
    );

    useEffect(() => {
      return () => {
        if (editorRef.current) {
          editorRef?.current?.destroy?.();
        }
      };
    }, [docId]);

    useEffect(() => {
      if (!editorRef.current) {
        return;
      }
      const editor = editorRef.current;

      const updateSelection = () => {
        const { state } = editor.view;
        const { from, to } = state.selection;
        documentActions.setHasEditorSelection(from !== to);
      };

      // Update initial state
      updateSelection();

      // Listen for selection changes
      editor.on('selectionUpdate', updateSelection);
      editor.on('blur', updateSelection);
      editor.on('focus', updateSelection);

      return () => {
        editor.off('selectionUpdate', updateSelection);
        editor.off('blur', updateSelection);
        editor.off('focus', updateSelection);
      };
    }, [editorRef.current, documentActions.setHasEditorSelection]);

    useEffect(() => {
      const insertBelow = (content: string) => {
        const editor = editorRef.current;
        if (!editor) {
          console.warn('editor is not initialized');
          return;
        }

        const isFocused = editor.isFocused;

        const { activeDocumentId } = useDocumentStore.getState();
        if (activeDocumentId !== docId) {
          return;
        }

        if (isFocused) {
          // Insert at current cursor position when focused
          lastCursorPosRef.current = editor?.view?.state?.selection?.$head?.pos;
          editor?.commands?.insertContentAt?.(lastCursorPosRef.current, content);
        } else if (lastCursorPosRef.current) {
          // Insert at last known cursor position
          editor
            ?.chain()
            .focus(lastCursorPosRef.current)
            .insertContentAt(
              {
                from: lastCursorPosRef.current,
                to: lastCursorPosRef.current,
              },
              content,
            )
            .run();
        } else {
          // Insert at the bottom of the document
          const docSize = editor?.state?.doc?.content?.size ?? 0;
          editor?.chain().focus(docSize).insertContentAt(docSize, content).run();
        }
      };

      editorEmitter.on('insertBelow', insertBelow);

      return () => {
        editorEmitter.off('insertBelow', insertBelow);
        documentActions.setActiveDocumentId(null);
      };
    }, [docId, documentActions.setActiveDocumentId]);

    useEffect(() => {
      if (editorRef.current) {
        const editor = editorRef.current;

        if (readOnly) {
          // ensure we sync the content just before setting the editor to readonly
          provider.forceSync();
        }
        editor.setOptions({ editable: !readOnly });
      }
    }, [readOnly, provider]);

    const handleBlur = () => {
      const editor = editorRef?.current;
      lastCursorPosRef.current = editor?.view?.state?.selection?.$head?.pos;
      documentActions.updateLastCursorPosRef(docId, lastCursorPosRef.current);
    };

    const handleFocus = () => {
      documentActions.setActiveDocumentId(docId);
    };

    // Handle component unmount
    useEffect(() => {
      return () => {
        if (useDocumentStore.getState().activeDocumentId === docId) {
          documentActions.setActiveDocumentId(undefined);
        }
      };
    }, [docId]);

    // Add effect to handle remote updates
    useEffect(() => {
      if (!provider || !editorRef.current) return;

      const handleRemoteUpdate = () => {
        if (editorRef.current && provider.status === 'connected') {
          try {
            // Force editor to re-render with latest content
            forceUpdateRef.current += 1;
            editorRef.current.commands.focus();

            // Update document stats
            const markdown = editorRef.current.storage.markdown.getMarkdown();
            documentActions.updateDocumentCharsCount(docId, wordsCount(markdown));

            // Ensure TOC is updated
            const tocExtension = editorRef.current.extensionManager.extensions.find(
              (ext) => ext.name === 'tableOfContents',
            );
            if (tocExtension?.options.onUpdate) {
              const { state } = editorRef.current;
              // Let the extension handle the TOC update internally
              tocExtension.options.onUpdate(state.doc.content);
            }
          } catch (error) {
            console.error('Error handling remote update:', error);
          }
        }
      };

      provider.on('update', handleRemoteUpdate);
      provider.on('synced', handleRemoteUpdate);

      return () => {
        provider.off('update', handleRemoteUpdate);
        provider.off('synced', handleRemoteUpdate);
      };
    }, [provider, docId, documentActions]);

    // Add effect to handle connection status changes
    useEffect(() => {
      if (!provider || !editorRef.current) return;

      const handleStatus = ({ status }: { status: string }) => {
        if (status === 'connected') {
          // Force sync when connection is established
          provider.forceSync();
          if (editorRef.current) {
            handleEditorUpdate(editorRef.current);
          }
        }
      };

      provider.on('status', handleStatus);

      return () => {
        provider.off('status', handleStatus);
      };
    }, [provider, handleEditorUpdate]);

    return (
      <div className={classNames('w-full', 'ai-note-editor-content-container')}>
        <div className="w-full h-full">
          <EditorRoot key={forceUpdateRef.current}>
            <EditorContent
              extensions={extensions}
              onCreate={({ editor }) => {
                editorRef.current = editor;
                documentActions.setActiveDocumentId(docId);
                // Force initial sync
                if (provider?.status === 'connected') {
                  provider.forceSync();
                }
              }}
              editable={!readOnly}
              className="w-full h-full border-muted sm:rounded-lg"
              editorProps={{
                handleDOMEvents: {
                  keydown: (_view, event) => handleCommandNavigation(event),
                },
                handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
                handleDrop: (view, event, _slice, moved) =>
                  handleImageDrop(view, event, moved, uploadFn),
                attributes: {
                  class:
                    'prose prose-md prose-headings:font-title font-default focus:outline-none max-w-full',
                  'data-doc-id': docId,
                },
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onUpdate={({ editor }) => {
                debouncedUpdates(editor);
              }}
              slotAfter={<ImageResizer />}
            >
              <CollabEditorCommand entityId={docId} entityType="document" />
              <CollabGenAIMenuSwitch
                contentSelector={{
                  text: t('knowledgeBase.context.addToContext'),
                  handleClick: () => handleAddToContext(selectedText),
                  createMemo: () => handleCreateMemo(selectedText),
                }}
              />
              <CollabGenAIBlockMenu />
            </EditorContent>
          </EditorRoot>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.docId === nextProps.docId,
);
