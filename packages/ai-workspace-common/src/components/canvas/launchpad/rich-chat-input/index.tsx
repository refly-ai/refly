import { memo, useCallback, forwardRef, useEffect, useState, useMemo, useRef } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchStoreShallow } from '@refly/stores';
import { cn } from '@refly/utils/cn';
import { useUserStoreShallow } from '@refly/stores';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import type { IContextItem } from '@refly/common-types';
import type { CanvasNodeType, ResourceType, ResourceMeta } from '@refly/openapi-schema';
import { getVariableIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import { mentionStyles } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/mention-style';
import { createRoot } from 'react-dom/client';
import { useStore } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { type MentionItem, MentionList } from './mentionList';

interface RichChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (text: string) => void;
  placeholder?: string;
  inputClassName?: string;
  maxRows?: number;
  minRows?: number;
  handleSendMessage: () => void;
  contextItems?: IContextItem[];
  setContextItems?: (items: IContextItem[]) => void;

  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
}

// Helper function to render NodeIcon consistently
const renderNodeIcon = (source: string, variableType: string, nodeAttrs: any) => {
  if (source === 'startNode') {
    // For startNode variables, use getStartNodeIcon to render variable type icons
    return getVariableIcon(variableType);
  } else if (source === 'stepRecord') {
    return React.createElement(NodeIcon, {
      type: 'skillResponse' as CanvasNodeType,
      small: true,
      filled: false,
      className: '!w-3.5 !h-3.5',
    });
  } else if (source === 'resultRecord' || source === 'myUpload') {
    const nodeType = variableType || 'document';
    return React.createElement(NodeIcon, {
      type: nodeType as CanvasNodeType,
      small: true,
      filled: false,
      url: nodeType === 'image' ? nodeAttrs.url : undefined,
      resourceType: nodeAttrs.resourceType,
      resourceMeta: nodeAttrs.resourceMeta,
      className: '!w-3.5 !h-3.5',
    });
  } else {
    const nodeType = variableType || 'document';
    return React.createElement(NodeIcon, {
      type: nodeType as CanvasNodeType,
      small: true,
      filled: false,
      className: '!w-3.5 !h-3.5',
    });
  }
};

// Custom Mention extension with icon support
const CustomMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      source: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-source'),
        renderHTML: (attributes) => {
          if (!attributes.source) {
            return {};
          }
          return {
            'data-source': attributes.source,
          };
        },
      },
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-url'),
        renderHTML: (attributes) => {
          if (!attributes.url) {
            return {};
          }
          return {
            'data-url': attributes.url,
          };
        },
      },
      variableType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-variable-type'),
        renderHTML: (attributes) => {
          if (!attributes.variableType) {
            return {};
          }
          return {
            'data-variable-type': attributes.variableType,
          };
        },
      },
      resourceType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-resource-type'),
        renderHTML: (attributes) => {
          if (!attributes.resourceType) {
            return {};
          }
          return {
            'data-resource-type': attributes.resourceType,
          };
        },
      },
      resourceMeta: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-resource-meta'),
        renderHTML: (attributes) => {
          if (!attributes.resourceMeta) {
            return {};
          }
          return {
            'data-resource-meta': JSON.stringify(attributes.resourceMeta),
          };
        },
      },
    };
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'mention';

      // Create icon container
      const iconContainer = document.createElement('span');
      iconContainer.className = 'mention-icon';

      // Create text container
      const textContainer = document.createElement('span');
      textContainer.className = 'mention-text';
      textContainer.textContent = node.attrs.label || node.attrs.id;

      const variableType = node.attrs.variableType || node.attrs.source;
      const source = node.attrs.source;

      let reactRoot: any = null;
      reactRoot = createRoot(iconContainer);

      // Use NodeIcon based on source type
      reactRoot.render(renderNodeIcon(source, variableType, node.attrs));

      dom.appendChild(iconContainer);
      dom.appendChild(textContainer);

      return {
        dom,
        destroy() {
          // Clean up React root when the node is destroyed
          if (reactRoot) {
            try {
              reactRoot.unmount();
            } catch {
              // Ignore cleanup errors
            }
          }
        },
      };
    };
  },
});

const RichChatInputComponent = forwardRef<HTMLDivElement, RichChatInputProps>(
  (
    {
      readonly,
      query,
      setQuery,
      inputClassName,
      handleSendMessage,
      onUploadImage,
      onUploadMultipleImages,
      onFocus,
      contextItems = [],
      setContextItems,
      placeholder,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const { nodes } = useCanvasData();
    const { nodes: realtimeNodes } = useRealtimeCanvasData();
    const { canvasId, workflow } = useCanvasContext();
    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));

    const { workflowVariables = [] } = workflow || {};

    // Get all available items including canvas nodes with fallback data
    const allItems: MentionItem[] = useMemo(() => {
      const workflowVariableItems: MentionItem[] = (workflowVariables || []).map((variable) => ({
        name: variable.name,
        description: variable.description || '',
        source: variable.source || 'startNode',
        variableType: variable.variableType || 'string',
        entityId: variable.variableId || '',
        nodeId: variable.variableId || '',
      }));

      // Get skillResponse nodes for step records
      const stepRecordItems: MentionItem[] =
        nodes
          ?.filter((node) => node.type === 'skillResponse')
          ?.map((node) => ({
            name: node.data?.title ?? t('canvas.richChatInput.untitledStep'),
            description: t('canvas.richChatInput.stepRecord'),
            source: 'stepRecord' as const,
            variableType: node.type, // Use actual node type
            entityId: node.data?.entityId || '',
            nodeId: node.id,
          })) ?? [];

      // Get result record nodes - same logic as ResultList component
      const resultRecordItems: MentionItem[] =
        nodes
          ?.filter(
            (node) =>
              ['document', 'codeArtifact', 'website', 'video', 'audio'].includes(node.type) ||
              (node.type === 'image' && !!node.data?.metadata?.resultId),
          )
          ?.map((node) => ({
            name: node.data?.title ?? t('canvas.richChatInput.untitledResult'),
            description: t('canvas.richChatInput.resultRecord'),
            source: 'resultRecord' as const,
            variableType: node.type, // Use actual node type
            entityId: node.data?.entityId,
            nodeId: node.id,
            metadata: {
              imageUrl: node.data?.metadata?.imageUrl,
              resourceType: node.data?.metadata?.resourceType as ResourceType | undefined,
              resourceMeta: node.data?.metadata?.resourceMeta as ResourceMeta | undefined,
            },
          })) ?? [];

      // Get my upload items from realtime canvas data
      const myUploadItems: MentionItem[] =
        realtimeNodes
          ?.filter(
            (node) =>
              node.type === 'resource' || (node.type === 'image' && !node.data?.metadata?.resultId),
          )
          ?.map((node) => ({
            name: node.data?.title ?? t('canvas.richChatInput.untitledUpload'),
            description: t('canvas.richChatInput.myUpload'),
            source: 'myUpload' as const,
            variableType: node.type,
            entityId: node.data?.entityId || '',
            nodeId: node.id,
            metadata: {
              imageUrl: node.data?.metadata?.imageUrl as string | undefined,
              resourceType: node.data?.metadata?.resourceType as ResourceType | undefined,
              resourceMeta: node.data?.metadata?.resourceMeta as ResourceMeta | undefined,
            },
          })) ?? [];

      return [...workflowVariableItems, ...stepRecordItems, ...resultRecordItems, ...myUploadItems];
    }, [workflowVariables, nodes, realtimeNodes]);

    // Keep latest items in a ref so Mention suggestion always sees fresh data
    const allItemsRef = useRef<MentionItem[]>(allItems);
    useEffect(() => {
      allItemsRef.current = allItems;
    }, [allItems]);

    // Use ref to store latest contextItems to avoid performance issues
    const contextItemsRef = useRef(contextItems);

    // Update ref when contextItems changes
    useEffect(() => {
      contextItemsRef.current = contextItems;
    }, [contextItems]);

    // Use ref to track previous canvas data to avoid infinite loops
    const prevCanvasDataRef = useRef({ canvasId: '', allItemsLength: 0 });

    // Create mention extension with custom suggestion
    const mentionExtension = useMemo(() => {
      return CustomMention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          char: '@',
          command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
            // Handle different types of items
            const item = props;

            // For step and result records, add to context instead of inserting text
            if (
              item.source === 'stepRecord' ||
              item.source === 'resultRecord' ||
              item.source === 'myUpload'
            ) {
              if (setContextItems && item.entityId) {
                // Create context item with correct type mapping
                const contextItem: IContextItem = {
                  entityId: item.entityId,
                  title: item.name,
                  type: (() => {
                    if (item.source === 'stepRecord') {
                      // For step records, use skillResponse type
                      return 'skillResponse' as CanvasNodeType;
                    } else if (item.source === 'resultRecord' || item.source === 'myUpload') {
                      // For result records and uploads, use the actual node type
                      // Validate that variableType is a valid CanvasNodeType
                      const validCanvasNodeTypes: CanvasNodeType[] = [
                        'document',
                        'codeArtifact',
                        'website',
                        'resource',
                        'skill',
                        'tool',
                        'skillResponse',
                        'toolResponse',
                        'memo',
                        'group',
                        'image',
                        'video',
                        'audio',
                        'mediaSkill',
                        'mediaSkillResponse',
                        'start',
                      ];

                      if (validCanvasNodeTypes.includes(item.variableType as CanvasNodeType)) {
                        return item.variableType as CanvasNodeType;
                      }

                      // Log warning for unknown types and fallback to document
                      console.warn(
                        `Unknown variableType "${item.variableType}" for source "${item.source}", falling back to "document"`,
                        { item, validTypes: validCanvasNodeTypes },
                      );
                      return 'document' as CanvasNodeType;
                    }
                    // Fallback for unexpected sources
                    console.warn(`Unexpected source "${item.source}", falling back to "document"`, {
                      item,
                    });
                    return 'document' as CanvasNodeType;
                  })(),
                  metadata: {
                    nodeId: item.nodeId,
                    source: item.source,
                    variableType: item.variableType, // Include variableType in metadata for debugging
                  },
                };

                // Add to context items using ref to get latest value
                if (setContextItems) {
                  // Check if already in context using ref
                  const currentContextItems = contextItemsRef.current || [];
                  const isAlreadyInContext = currentContextItems.some(
                    (ctxItem) => ctxItem.entityId === item.entityId,
                  );

                  if (!isAlreadyInContext) {
                    setContextItems([...currentContextItems, contextItem]);
                  }
                }

                // Insert a placeholder text to show the selection
                editor
                  .chain()
                  .focus()
                  .insertContentAt(range, [
                    {
                      type: 'mention',
                      attrs: {
                        id: item.name,
                        label: item.name, // Don't include @ in label
                        source: item.source, // Store source for later processing
                        variableType: item.variableType || item.source,
                        url: item.metadata?.imageUrl,
                        resourceType: item.metadata?.resourceType,
                        resourceMeta: item.metadata?.resourceMeta,
                      },
                    },
                    {
                      type: 'text',
                      text: ' ',
                    },
                  ])
                  .run();
              }
            } else {
              // For regular variables (startNode and resourceLibrary), insert as normal mention
              // These will be converted to Handlebars format when sending
              editor
                .chain()
                .focus()
                .insertContentAt(range, [
                  {
                    type: 'mention',
                    attrs: {
                      id: item.name,
                      label: item.name, // Don't include @ in label
                      source: item.source, // Store source for later processing
                      variableType: item.variableType || item.source,
                      url: item.metadata?.imageUrl,
                      resourceType: item.metadata?.resourceType,
                      resourceMeta: item.metadata?.resourceMeta,
                    },
                  },
                  {
                    type: 'text',
                    text: ' ',
                  },
                ])
                .run();
            }
          },
          items: ({ query }: { query: string }) => {
            const sourceItems = allItemsRef.current ?? [];
            if (!query) {
              return sourceItems;
            }
            return sourceItems.filter((item) => {
              const name = item?.name ?? '';
              const desc = item?.description ?? '';
              const q = query?.toLowerCase() ?? '';
              return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
            });
          },
          render: () => {
            let component: any;
            let popup: any;
            const parsePlacement = (inst: any): 'top' | 'bottom' => {
              const resolved =
                inst?.popperInstance?.state?.placement ??
                inst?.popper?.getAttribute?.('data-placement') ??
                inst?.state?.placement ??
                inst?.props?.placement ??
                'bottom-start';
              const base = String(resolved).split('-')[0];
              return base === 'top' ? 'top' : 'bottom';
            };

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  props: { ...props, placement: 'bottom' },
                  editor: props.editor,
                });

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  theme: 'custom',
                  arrow: false,
                  offset: [0, 8],
                  onMount(instance) {
                    const placement = parsePlacement(instance);
                    component.updateProps({ ...props, placement });
                  },
                  onShown(instance) {
                    const placement = parsePlacement(instance);
                    component.updateProps({ ...props, placement });
                  },
                });
              },
              onUpdate(props: any) {
                component.updateProps({ ...props });
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
                // Read actual placement after Popper updates layout
                requestAnimationFrame(() => {
                  try {
                    const instance = popup?.[0];
                    const placement = parsePlacement(instance);
                    component.updateProps({ ...props, placement });
                  } catch {
                    // noop
                  }
                });
                setTimeout(() => {
                  try {
                    const instance = popup?.[0];
                    const placement = parsePlacement(instance);
                    component.updateProps({ ...props, placement });
                  } catch {
                    // noop
                  }
                }, 0);
              },
              onExit() {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
        },
      });
    }, [setContextItems]);

    // Create Tiptap editor
    const internalUpdateRef = useRef(false);

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
      () => [StarterKit, mentionExtension, placeholderExtension],
      [mentionExtension, placeholderExtension],
    );

    const editor = useEditor(
      {
        extensions,
        content: query,
        editable: !readonly,
        onUpdate: ({ editor }) => {
          const content = editor.getText();
          // Keep raw text in state for UX; convert to handlebars only on send
          internalUpdateRef.current = true;
          setQuery(content);
        },
        editorProps: {
          attributes: {
            class: cn(
              'prose prose-sm max-w-none focus:outline-none',
              inputClassName,
              readonly && 'cursor-not-allowed',
              isFocused ? 'nodrag nopan nowheel cursor-text' : '!cursor-pointer',
            ),
          },
        },
      },
      [placeholder],
    );

    // Function to convert mentions to Handlebars format
    const convertMentionsToHandlebars = useCallback(
      (content: string) => {
        if (!editor) return content;

        // Instead of string replacement, we'll build the content from scratch
        // by traversing the document and handling mention nodes properly
        let processedContent = '';

        editor.state.doc.descendants((node) => {
          if (node.type.name === 'mention') {
            const mentionName = node.attrs.label || node.attrs.id;
            const source = node.attrs.source;

            // Only convert startNode and resourceLibrary variables to @variableName format
            if (mentionName && (source === 'startNode' || source === 'resourceLibrary')) {
              processedContent += `@${mentionName} `;
            } else {
              // For other types (stepRecord, resultRecord), just add the name without @
              processedContent += mentionName;
            }
          } else if (node.type.name === 'text') {
            processedContent += node.text;
          }
        });

        return processedContent;
      },
      [editor],
    );

    // Build tiptap JSON content from a string with @variableName format
    const buildContentFromHandlebars = useCallback(
      (content: string) => {
        const nodes: any[] = [];
        if (!content) return nodes;

        const findVarMeta = (name: string) => {
          // Priority 1: Look in allItems first (includes canvas-based items and workflow variables)
          const foundFromAll = (allItems || []).find((it: any) => it?.name === name);
          if (foundFromAll) {
            return {
              source: foundFromAll?.source ?? 'startNode',
              variableType: foundFromAll?.variableType ?? 'string',
            };
          }

          // Priority 2: Look in variables prop (most reliable for startNode)
          const foundInVariables = (workflowVariables || []).find((v: any) => v?.name === name);
          if (foundInVariables) {
            return {
              source: foundInVariables?.source ?? 'startNode',
              variableType: foundInVariables?.variableType ?? 'string',
            };
          }

          // Fallback: Default to startNode with string type
          return {
            source: 'startNode',
            variableType: 'string',
          };
        };

        // Prepare name list sorted by length desc to prefer the longest match
        const allNames = Array.from(
          new Set((allItems || []).map((it: any) => it?.name).filter(Boolean)),
        ) as string[];
        allNames.sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0));

        let i = 0;
        let textBuffer = '';
        while (i < content.length) {
          const ch = content[i];
          if (ch === '@') {
            // Try to match any known name right after '@'
            let matchedName: string | null = null;
            for (const name of allNames) {
              const candidate = content.slice(i + 1, i + 1 + name.length);
              if (candidate === name) {
                const nextChar = content[i + 1 + name.length] ?? '';
                if (nextChar === ' ' || nextChar === '\n' || nextChar === '' || nextChar === '\t') {
                  matchedName = name;
                  break;
                }
              }
            }

            if (matchedName) {
              if (textBuffer) {
                nodes.push({ type: 'text', text: textBuffer });
                textBuffer = '';
              }
              const meta = findVarMeta(matchedName);
              nodes.push({
                type: 'mention',
                attrs: {
                  id: matchedName,
                  label: matchedName,
                  source: meta.source,
                  variableType: meta.variableType,
                },
              });
              // Consume '@' + name but do NOT consume trailing whitespace to preserve original spacing
              i = i + 1 + matchedName.length;
              continue;
            }
          }
          // Default: accumulate as plain text
          textBuffer += ch;
          i += 1;
        }

        if (textBuffer) {
          nodes.push({ type: 'text', text: textBuffer });
        }

        return nodes;
      },
      [workflowVariables, allItems],
    );

    // Enhanced handleSendMessage that converts mentions to Handlebars
    const handleSendMessageWithHandlebars = useCallback(() => {
      if (editor) {
        const currentContent = editor.getText();
        const processedContent = convertMentionsToHandlebars(currentContent);
        // Update the query with the processed content before sending
        setQuery(processedContent);
        // Call the original handleSendMessage
        handleSendMessage();
      } else {
        handleSendMessage();
      }
    }, [editor, convertMentionsToHandlebars, setQuery, handleSendMessage]);

    // Update editor content when query changes externally
    useEffect(() => {
      if (!editor) return;
      if (internalUpdateRef.current) {
        // Skip applying content when the change originated from editor updates
        internalUpdateRef.current = false;
        return;
      }
      const currentText = editor.getText();
      const nextText = query ?? '';
      if (currentText !== nextText) {
        // Convert handlebars variables back to mention nodes for rendering
        const nodes = buildContentFromHandlebars(nextText);
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
          internalUpdateRef.current = true;
          editor.commands.setContent(jsonDoc);
        } else {
          internalUpdateRef.current = true;
          editor.commands.setContent(nextText);
        }
      }
    }, [query, editor, buildContentFromHandlebars]);

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
        const nodes = buildContentFromHandlebars(query);
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
          internalUpdateRef.current = true;
          editor.commands.setContent(jsonDoc);
        }
      }
    }, [canvasId, editor, query, buildContentFromHandlebars, allItems]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        // Check if mention suggestion is currently open
        const isMentionSuggestionOpen =
          document.querySelector('.tippy-box[data-theme="custom"]') !== null;

        // If mention suggestion is open, don't handle navigation keys or Enter
        if (isMentionSuggestionOpen) {
          const key = e.key;
          if (
            key === 'ArrowUp' ||
            key === 'ArrowDown' ||
            key === 'ArrowLeft' ||
            key === 'ArrowRight' ||
            key === 'Enter'
          ) {
            // Let the mention list handle these keys
            return;
          }
        }

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

          // Ctrl/Meta + Enter should always send the message
          if ((e.ctrlKey || e.metaKey) && (query?.trim() || !isLogin)) {
            e.preventDefault();
            handleSendMessageWithHandlebars();
            return;
          }

          // For regular Enter key, send message if not in mention suggestion
          if (!e.shiftKey && (query?.trim() || !isLogin)) {
            e.preventDefault();
            handleSendMessageWithHandlebars();
          }
        }
      },
      [query, readonly, handleSendMessageWithHandlebars, searchStore, isLogin],
    );

    // Handle focus event and propagate it upward
    const handleFocus = useCallback(() => {
      setIsFocused(true);
      if (onFocus && !readonly) {
        onFocus();
      }
    }, [onFocus, readonly, setIsFocused]);

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
          ref={ref}
          className={cn(
            'w-full h-full flex flex-col flex-grow overflow-y-auto overflow-x-hidden relative ',
            isDragging && 'ring-2 ring-green-500 ring-opacity-50 rounded-lg',
            readonly && 'opacity-70 cursor-not-allowed',
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

          <div
            className={cn('flex-1 min-h-0', readonly && 'cursor-not-allowed')}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={() => setIsFocused(false)}
            onPaste={handlePaste}
          >
            {editor ? (
              <EditorContent
                editor={editor}
                className="h-full"
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
