import { useEffect, useMemo, useRef, memo, useCallback } from 'react';
import { useThrottledCallback } from 'use-debounce';
import classNames from 'classnames';
import wordsCount from 'words-count';
import { useTranslation } from 'react-i18next';
import {
  CollabEditorCommand,
  CollabGenAIBlockMenu,
  CollabGenAIMenuSwitch,
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
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';

import { useDocumentContext } from '@refly-packages/ai-workspace-common/context/document';

export const PureCollaborativeEditor = memo(
  ({ docId }: { docId: string }) => {
    const { t } = useTranslation();
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

    // Memoize the update function to prevent unnecessary re-renders
    const handleEditorUpdate = useCallback(
      (editor: EditorInstance) => {
        if (!provider?.status || provider.status !== 'connected') {
          return;
        }

        const markdown = editor.storage.markdown.getMarkdown();

        documentActions.updateDocumentCharsCount(docId, wordsCount(markdown));
      },
      [docId, provider?.status, documentActions],
    );

    // Use throttle with memoized function
    const throttledUpdates = useThrottledCallback(handleEditorUpdate, 300, { leading: true });

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
      if (editorRef.current) {
        const editor = editorRef.current;

        if (readOnly) {
          // ensure we sync the content just before setting the editor to readonly
          provider.forceSync();
        }
        editor.setOptions({ editable: !readOnly });
      }
    }, [readOnly, provider]);

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
              onUpdate={({ editor }) => {
                throttledUpdates(editor);
              }}
              slotAfter={<ImageResizer />}
            >
              <CollabEditorCommand entityId={docId} entityType="document" />
              <CollabGenAIMenuSwitch />
              <CollabGenAIBlockMenu />
            </EditorContent>
          </EditorRoot>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.docId === nextProps.docId,
);
