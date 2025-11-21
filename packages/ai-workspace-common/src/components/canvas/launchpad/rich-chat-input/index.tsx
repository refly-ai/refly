import { mentionStyles } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/mention-style';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import {
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useAgentNodeManagement } from '@refly-packages/ai-workspace-common/hooks/canvas/use-agent-node-management';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-drive-files';
import type { IContextItem } from '@refly/common-types';
import type { CanvasNodeType, GenericToolset } from '@refly/openapi-schema';
import { useSearchStoreShallow, useUserStoreShallow } from '@refly/stores';
import { cn } from '@refly/utils/cn';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useStore } from '@xyflow/react';
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import AtomicInlineKeymap from './atomic-inline-keymap';
import { useListMentionItems } from './hooks/use-list-mention-items';
import { createMentionExtension, type MentionPosition } from './mention-extension';
import { type MentionItem } from './mentionList';
import { PasteCleanupExtension } from './paste-extension';
import {
  buildNodesFromContent,
  createContextItemFromMentionItem,
  serializeDocToTokens,
} from './utils';
import { useAgentConnections } from '@refly-packages/ai-workspace-common/hooks/canvas/use-agent-connections';

interface RichChatInputProps {
  readonly: boolean;
  placeholder?: string;
  inputClassName?: string;
  maxRows?: number;
  minRows?: number;
  handleSendMessage: () => void;
  mentionPosition?: MentionPosition;

  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
  nodeId?: string;
}

export interface RichChatInputRef {
  focus: () => void;
  insertAtSymbol?: () => void;
}

const RichChatInputComponent = forwardRef<RichChatInputRef, RichChatInputProps>(
  (
    {
      readonly,
      handleSendMessage,
      onUploadImage,
      onUploadMultipleImages,
      onFocus,
      placeholder,
      mentionPosition = 'bottom-start',
      nodeId,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const { canvasId, workflow } = useCanvasContext();
    const { data: files } = useFetchDriveFiles();
    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));
    const { query, setQuery, setContextItems, setSelectedToolsets } =
      useAgentNodeManagement(nodeId);
    const { connectToUpstreamAgent } = useAgentConnections();

    const [isMentionListVisible, setIsMentionListVisible] = useState(false);

    const { workflowVariables = [] } = workflow || {};

    // Gate mention suggestions until explicit user interaction
    // Prevent auto-popup on initial load when content already contains '@xx'
    const hasUserInteractedRef = useRef(false);
    const popupInstanceRef = useRef<any>(null);

    // Get all available items including canvas nodes with fallback data
    const allItems = useListMentionItems(nodeId);

    // Keep latest items in a ref so Mention suggestion always sees fresh data
    const allItemsRef = useRef<MentionItem[]>(allItems);

    useEffect(() => {
      allItemsRef.current = allItems;
    }, [allItems]);

    // Use ref to track previous canvas data to avoid infinite loops
    const prevCanvasDataRef = useRef({ canvasId: '', allItemsLength: 0 });

    // Helper function to add item to context items
    const addToContextItems = useCallback(
      (contextItem: IContextItem) => {
        setContextItems((prevContextItems) => {
          const isAlreadyInContext = (prevContextItems ?? []).some(
            (ctxItem) => ctxItem.entityId === contextItem.entityId,
          );
          if (isAlreadyInContext) {
            return prevContextItems ?? [];
          }
          return [...(prevContextItems ?? []), contextItem];
        });
      },
      [setContextItems],
    );

    // Helper function to add toolset to selected toolsets
    const addToSelectedToolsets = useCallback(
      (toolsetItem: GenericToolset) => {
        setSelectedToolsets((prevToolsets) => {
          const isAlreadySelected = (prevToolsets ?? []).some(
            (selectedItem) => selectedItem.id === toolsetItem.id,
          );
          if (isAlreadySelected) {
            return prevToolsets ?? [];
          }
          return [...(prevToolsets ?? []), toolsetItem];
        });
      },
      [setSelectedToolsets],
    );

    const addToUpstreamAgents = useCallback(
      (resultId: string) => {
        connectToUpstreamAgent(nodeId, resultId);
      },
      [connectToUpstreamAgent, nodeId],
    );

    // Helper function to insert mention into editor
    const insertMention = useCallback((editor: any, range: any, attrs: any) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'mention',
            attrs,
          },
          {
            type: 'text',
            text: ' ',
          },
        ])
        .run();
    }, []);

    const handleCommand = useCallback(
      ({ editor, range, props }: { editor: any; range: any; props: MentionItem }) => {
        const item = props;

        // For step and result records, add to context instead of inserting text
        if (item.source === 'agents' || item.source === 'files') {
          const mediaUrl =
            item.metadata?.imageUrl || item.metadata?.videoUrl || item.metadata?.audioUrl;

          insertMention(editor, range, {
            id: item.entityId || item.nodeId || item.variableId || item.name,
            label: item.name,
            source: item.source,
            variableType: item.variableType || item.source,
            url: mediaUrl,
            resourceType: item.metadata?.resourceType,
            resourceMeta: item.metadata?.resourceMeta,
            entityId: item.entityId || item.nodeId || item.variableId || item.name,
          });

          setTimeout(() => {
            if (item.source === 'files') {
              const contextItem = createContextItemFromMentionItem(item);
              addToContextItems(contextItem);
            } else if (item.source === 'agents') {
              addToUpstreamAgents(item.entityId);
            }
          }, 100);
        } else if (item.source === 'toolsets' || item.source === 'tools') {
          // Insert a tool mention with toolset metadata stored in node attrs
          insertMention(editor, range, {
            id: item.toolsetId || item.name,
            label: item.name,
            source: item.source,
            variableType: 'tool',
            entityId: item.toolsetId || item.name,
            toolset: item.toolset,
            toolsetId: item.toolsetId,
          });

          setTimeout(() => {
            // Add toolset to selected toolsets
            if (setSelectedToolsets && item.toolsetId && item.toolset) {
              addToSelectedToolsets(item.toolset);
            }
          }, 100);
        } else if (item.variableType === 'resource') {
          // For resource type variables, find the corresponding resource data and add to context
          if (item.variableValue?.length && item.variableValue[0]?.resource) {
            const resourceValue = item.variableValue[0].resource;
            const resource = files.find((r) => r.fileId === resourceValue.entityId);

            const contextItem: IContextItem = {
              entityId: resourceValue.entityId,
              title: resource?.name ?? resourceValue.name,
              type: 'resource' as CanvasNodeType,
              metadata: {
                source: 'myUpload',
                storageKey: resourceValue.storageKey,
                resourceType: resourceValue.fileType,
                resourceMeta: resource,
              },
            };

            insertMention(editor, range, {
              id: resourceValue.entityId,
              label: resourceValue.name,
              source: 'myUpload',
              variableType: 'resource',
              url: resourceValue.storageKey,
              resourceType: resourceValue.fileType,
              resourceMeta: resource,
              entityId: resourceValue.entityId,
            });

            setTimeout(() => {
              addToContextItems(contextItem);
            }, 100);
          }
        } else {
          // For regular variables (startNode and resourceLibrary), insert as normal mention
          // These will be converted to Handlebars format when sending
          insertMention(editor, range, {
            id: item.variableId || item.name,
            label: item.name,
            source: item.source,
            variableType: item.variableType || item.source,
            url: item.metadata?.imageUrl,
            resourceType: item.metadata?.resourceType,
            resourceMeta: item.metadata?.resourceMeta,
            entityId: item.variableId,
          });
        }
      },
      [addToContextItems, addToSelectedToolsets, insertMention, files],
    );

    // Create mention extension with custom suggestion
    const mentionExtension = useMemo(() => {
      return createMentionExtension({
        handleCommand,
        hasUserInteractedRef,
        allItemsRef,
        mentionPosition,
        setIsMentionListVisible,
      });
    }, [
      handleCommand,
      hasUserInteractedRef,
      allItemsRef,
      mentionPosition,
      setIsMentionListVisible,
    ]);

    // Keyboard shortcut: Alt+Cmd+V (Mac) or Alt+Ctrl+V (Windows) to trigger variable extraction
    const selectedSkillNodeId = useStore(
      useShallow((state: any) => {
        const nodes = state.nodes || [];
        const selected = nodes.find((n: any) => n?.selected && n?.type === 'skill');
        return selected?.id || '';
      }),
    );

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const isV = (e.key || '').toLowerCase() === 'v';
        const isAlt = !!e.altKey;
        const isCmd = !!e.metaKey; // Mac
        const isCtrl = !!e.ctrlKey;

        if (isV && isAlt && (isCmd || isCtrl)) {
          if (selectedSkillNodeId) {
            e.preventDefault();
            nodeActionEmitter.emit(createNodeEventName(selectedSkillNodeId, 'extractVariables'));
          }
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedSkillNodeId]);

    // Create placeholder extension with dynamic placeholder
    const placeholderExtension = useMemo(() => {
      return Placeholder.configure({
        placeholder: placeholder || t('canvas.richChatInput.defaultPlaceholder'),
      });
    }, [placeholder, t]);

    // Create all extensions array
    const extensions = useMemo(
      () => [
        AtomicInlineKeymap,
        StarterKit,
        mentionExtension,
        placeholderExtension,
        PasteCleanupExtension,
      ],
      [mentionExtension, placeholderExtension, PasteCleanupExtension, AtomicInlineKeymap],
    );

    const editor = useEditor(
      {
        extensions,
        content: query,
        editable: !readonly,
        onUpdate: ({ editor }) => {
          const content = serializeDocToTokens(editor?.state?.doc);
          // Keep raw text in state for UX; content is already serialized with mentions
          setQuery(content);
        },
        onFocus: () => {
          handleFocus();
        },
        onBlur: () => {
          setIsFocused(false);
        },
        editorProps: {
          attributes: {
            class: cn('prose prose-sm max-w-none focus:outline-none'),
          },
        },
      },
      [placeholder],
    );

    // Expose focus and insertAtSymbol methods through ref
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (editor && !readonly) {
            editor.commands.focus();
          }
        },
        insertAtSymbol: () => {
          if (editor && !readonly) {
            hasUserInteractedRef.current = true;
            // If editor wasn't focused, move cursor to the end
            const wasFocused = editor.isFocused;
            if (!wasFocused) {
              editor.commands.focus('end');
            } else {
              editor.commands.focus();
            }
            editor.commands.insertContent('@');
            // Try to show mention popup after a short delay
            setTimeout(() => {
              if (popupInstanceRef.current) {
                popupInstanceRef.current.show();
              }
            }, 50);
          }
        },
      }),
      [editor, readonly, hasUserInteractedRef, popupInstanceRef],
    );

    // Sync all mentions in the editor to contextItems/selectedToolsets
    const syncMentionsToState = useCallback(() => {
      if (!editor) return;

      const doc = editor?.state?.doc;
      if (!doc) return;

      const mentionNodes: any[] = [];
      doc.descendants((node: any) => {
        if (node?.type?.name === 'mention') {
          mentionNodes.push(node);
        }
      });

      // Collect file mentions and sync to contextItems
      const fileMentions = mentionNodes.filter(
        (node) => node?.attrs?.source === 'files' || node?.attrs?.source === 'products',
      );

      if (fileMentions.length > 0) {
        const newContextItems: IContextItem[] = [];
        for (const mention of fileMentions) {
          const attrs = mention?.attrs;
          if (attrs?.entityId) {
            const contextItem: IContextItem = {
              entityId: attrs.entityId,
              title: attrs.label || attrs.id,
              type: 'file',
              metadata: {
                source: attrs.source || 'files',
                resourceType: attrs.resourceType,
                resourceMeta: attrs.resourceMeta,
              },
            };
            newContextItems.push(contextItem);
          }
        }

        if (newContextItems.length > 0) {
          setContextItems((prevContextItems) => {
            const existing = prevContextItems ?? [];
            const merged = [...existing];
            for (const item of newContextItems) {
              if (!existing.some((ctx) => ctx.entityId === item.entityId)) {
                merged.push(item);
              }
            }
            return merged;
          });
        }
      }

      // Collect tool mentions and sync to selectedToolsets
      const toolMentions = mentionNodes.filter(
        (node) => node?.attrs?.source === 'tools' || node?.attrs?.source === 'toolsets',
      );

      if (toolMentions.length > 0) {
        const newToolsets: GenericToolset[] = [];
        for (const mention of toolMentions) {
          const attrs = mention?.attrs;
          if (attrs?.toolset && attrs?.toolsetId) {
            newToolsets.push(attrs.toolset);
          }
        }

        if (newToolsets.length > 0) {
          setSelectedToolsets((prevToolsets) => {
            const existing = prevToolsets ?? [];
            const merged = [...existing];
            for (const toolset of newToolsets) {
              if (!existing.some((t) => t.id === toolset.id)) {
                merged.push(toolset);
              }
            }
            return merged;
          });
        }
      }
    }, [editor, setContextItems, setSelectedToolsets]);

    // Enhanced handleSendMessage that converts mentions to Handlebars
    const handleSendMessageWithMentions = useCallback(() => {
      if (editor) {
        const currentContent = serializeDocToTokens(editor?.state?.doc);
        // Update the query with the serialized content before sending
        setQuery(currentContent);

        // Sync all mentions to state before sending
        syncMentionsToState();

        // Call the original handleSendMessage
        handleSendMessage();
      } else {
        handleSendMessage();
      }
    }, [editor, setQuery, handleSendMessage, syncMentionsToState]);

    const isSyncedExternalQuery = useRef(false);

    // Reset sync flag when query changes externally
    useEffect(() => {
      isSyncedExternalQuery.current = false;
    }, [query]);

    // Update editor content when query changes externally
    useEffect(() => {
      if (!editor || isSyncedExternalQuery.current) return;
      const currentText = serializeDocToTokens(editor?.state?.doc);
      const nextText = query ?? '';
      if (currentText !== nextText) {
        // Convert handlebars variables back to mention nodes for rendering
        const nodes = buildNodesFromContent(nextText, workflowVariables, allItems);
        // Preserve full selection range to avoid collapsing selection
        const prevFrom = editor.state?.selection?.from ?? null;
        const prevTo = editor.state?.selection?.to ?? null;
        if (nodes.length > 0) {
          const jsonDoc = {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: nodes,
              },
            ],
          } as any;
          editor.commands.setContent(jsonDoc);
        } else {
          editor.commands.setContent(nextText);
        }

        // Restore selection range if available
        if (prevFrom !== null && prevTo !== null) {
          const size = editor?.state?.doc?.content?.size ?? 0;
          const clampedFrom = Math.max(0, Math.min(prevFrom, size));
          const clampedTo = Math.max(0, Math.min(prevTo, size));
          editor.commands.setTextSelection({ from: clampedFrom, to: clampedTo });
        }
      }
      isSyncedExternalQuery.current = true;
    }, [query, editor, workflowVariables, allItems]);

    // Additional effect to re-render content when canvas data becomes available
    useEffect(() => {
      if (!editor || !query) return;

      // Check if canvas data has actually changed to avoid infinite loops
      const currentCanvasData = {
        canvasId: canvasId || '',
        allItemsLength: allItems?.length || 0,
      };

      const prevCanvasData = prevCanvasDataRef.current;
      const hasCanvasDataChanged =
        currentCanvasData.canvasId !== prevCanvasData.canvasId ||
        currentCanvasData.allItemsLength !== prevCanvasData.allItemsLength;

      if (!hasCanvasDataChanged) return;

      // Update the ref with current data
      prevCanvasDataRef.current = currentCanvasData;

      // Check if we have the necessary data to render mentions
      const hasCanvasData = allItems && allItems.length > 0;

      if (hasCanvasData) {
        // Try to re-render with current data
        const nodes = buildNodesFromContent(query, workflowVariables, allItems);
        if (nodes.length > 0) {
          const jsonDoc = {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: nodes,
              },
            ],
          } as any;

          // Preserve full selection range
          const prevFrom = editor.state?.selection?.from ?? null;
          const prevTo = editor.state?.selection?.to ?? null;
          editor.commands.setContent(jsonDoc);

          if (prevFrom !== null && prevTo !== null) {
            const size = editor?.state?.doc?.content?.size ?? 0;
            const clampedFrom = Math.max(0, Math.min(prevFrom, size));
            const clampedTo = Math.max(0, Math.min(prevTo, size));
            editor.commands.setTextSelection({ from: clampedFrom, to: clampedTo });
          }
        }
      }
    }, [canvasId, editor, query, workflowVariables, allItems]);

    const isCursorAfterAtToken = useCallback((state: any): boolean => {
      try {
        const cursorPos = state?.selection?.from ?? 0;
        const lookback = 128;
        const fromPos = Math.max(0, cursorPos - lookback);
        const textBefore = state.doc.textBetween(fromPos, cursorPos) || '';
        const atIndex = textBefore.lastIndexOf('@');

        if (atIndex < 0) return false;

        const token = textBefore.slice(atIndex);
        const charBeforeAt = textBefore[atIndex - 1] ?? '';
        const isBoundaryValid = atIndex === 0 || /\s/.test(charBeforeAt);

        if (!isBoundaryValid) return false;

        // Check if token is contiguous (no spaces) and starts with @
        return /^@[^\s@]*$/.test(token);
      } catch {
        return false;
      }
    }, []);

    // Try to show mention popup if cursor is after @ token
    const tryShowMentionPopup = useCallback(() => {
      try {
        if (!editor || !popupInstanceRef.current || isMentionListVisible) return;

        const state = editor.state;
        if (isCursorAfterAtToken(state)) {
          popupInstanceRef.current.show();
        }
      } catch {
        // noop
      }
    }, [editor, isMentionListVisible, isCursorAfterAtToken]);

    const handlePopupShow = useCallback(() => {
      hasUserInteractedRef.current = true;
      tryShowMentionPopup();
    }, [tryShowMentionPopup, hasUserInteractedRef]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        handlePopupShow();

        // Handle Ctrl+K or Cmd+K to open search
        if (e.keyCode === 75 && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          searchStore.setIsSearchOpen(true);
        }

        // Handle the Enter key
        if (e.keyCode === 13) {
          // Shift + Enter creates a new line (let default behavior handle it)
          if (e.shiftKey) {
            return;
          }

          // If mention list is visible, let it handle the Enter key
          if (isMentionListVisible) {
            return;
          }
        }
      },
      [
        query,
        readonly,
        handleSendMessageWithMentions,
        searchStore,
        isLogin,
        isMentionListVisible,
        handlePopupShow,
      ],
    );

    // Handle focus event and propagate it upward
    const handleFocus = useCallback(() => {
      if (readonly) return;
      setIsFocused(true);
      handlePopupShow();

      if (onFocus) {
        onFocus();
      }
    }, [onFocus, readonly, setIsFocused, handlePopupShow]);

    const handlePaste = useCallback(
      async (e: React.ClipboardEvent) => {
        if (readonly || (!onUploadImage && !onUploadMultipleImages)) {
          return;
        }

        const items = e.clipboardData?.items;

        if (!items?.length) {
          return;
        }

        const imageFiles: File[] = [];

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          if (imageFiles.length === 1 && onUploadImage) {
            await onUploadImage(imageFiles[0]);
          } else if (onUploadMultipleImages && imageFiles.length > 0) {
            await onUploadMultipleImages(imageFiles);
          }
        }
      },
      [onUploadImage, onUploadMultipleImages, readonly],
    );

    return (
      <>
        <style>{mentionStyles}</style>
        <div
          ref={ref as any}
          className={cn(
            'w-full h-full flex flex-col flex-grow overflow-y-auto overflow-x-hidden relative',
            isDragging && 'ring-2 ring-green-500 ring-opacity-50 rounded-lg',
            readonly && 'opacity-70 cursor-not-allowed',
            isFocused ? 'nodrag nopan nowheel cursor-text' : '!cursor-text',
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!readonly) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!readonly) setIsDragging(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (readonly) return;

            setIsDragging(false);

            if (!onUploadImage && !onUploadMultipleImages) return;

            const files = Array.from(e.dataTransfer.files);
            const imageFiles = files.filter((file) => file.type.startsWith('image/'));

            if (imageFiles.length > 0) {
              try {
                if (imageFiles.length === 1 && onUploadImage) {
                  await onUploadImage(imageFiles[0]);
                } else if (onUploadMultipleImages) {
                  await onUploadMultipleImages(imageFiles);
                }
              } catch (error) {
                console.error('Failed to upload images:', error);
              }
            }
          }}
        >
          {isDragging && !readonly && (
            <div className="absolute inset-0 bg-green-50/50 flex items-center justify-center pointer-events-none z-10 rounded-lg border-2 border-green-500/30">
              <div className="text-green-600 text-sm font-medium">{t('common.dropImageHere')}</div>
            </div>
          )}

          <div className="flex-1" onKeyDownCapture={handleKeyDown} onPaste={handlePaste}>
            {editor ? (
              <EditorContent
                className="h-full"
                editor={editor}
                data-cy="rich-chat-input"
                data-placeholder={placeholder || t('canvas.richChatInput.defaultPlaceholder')}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                {t('canvas.richChatInput.loadingEditor')}
              </div>
            )}
          </div>
        </div>
      </>
    );
  },
);

RichChatInputComponent.displayName = 'RichChatInputComponent';

export const RichChatInput = memo(RichChatInputComponent) as typeof RichChatInputComponent;

RichChatInput.displayName = 'RichChatInput';
