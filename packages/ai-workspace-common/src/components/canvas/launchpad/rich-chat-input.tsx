import { memo, useCallback, forwardRef, useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchStoreShallow } from '@refly/stores';
import type { MentionVariable } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/types';
import { cn } from '@refly/utils/cn';
import { useUserStoreShallow } from '@refly/stores';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import SVGX from '../../../assets/x.svg';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import type { IContextItem } from '@refly/common-types';
import {
  getStartNodeIcon,
  getVariableIcon,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import { AiChat } from 'refly-icons';
import { mentionStyles } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/mention-style';
import { createRoot } from 'react-dom/client';

interface RichChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (text: string) => void;
  variables?: MentionVariable[];
  selectedSkillName?: string | null;
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
// Custom mention suggestion component with improved UI design
const MentionList = ({ items, command }: { items: any[]; command: any }) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [resourceLibraryType, setResourceLibraryType] = useState<
    'uploads' | 'stepRecord' | 'resultRecord'
  >('uploads');
  const { nodes } = useCanvasData();

  // Group items by source and create canvas-based items
  const groupedItems = useMemo(() => {
    const startNodeItems = items.filter((item) => item.source === 'startNode');
    const resourceLibraryItems = items.filter((item) => item.source === 'resourceLibrary');

    // Get skillResponse nodes for step records
    const stepRecordItems =
      nodes
        ?.filter((node) => node.type === 'skillResponse')
        ?.map((node) => ({
          name: node.data?.title ?? t('canvas.richChatInput.untitledStep'),
          description: t('canvas.richChatInput.stepRecord'),
          source: 'stepRecord' as const,
          variableType: node.type,
          entityId: node.data?.entityId,
          nodeId: node.id,
        })) ?? [];

    // Get non-skill nodes for result records
    const resultRecordItems =
      nodes
        ?.filter(
          (node) => node.type !== 'skill' && node.type !== 'skillResponse' && node.type !== 'start',
        )
        ?.map((node) => ({
          name: node.data?.title ?? t('canvas.richChatInput.untitledResult'),
          description: t('canvas.richChatInput.resultRecord'),
          source: 'resultRecord' as const,
          variableType: node.type,
          entityId: node.data?.entityId,
          nodeId: node.id,
        })) ?? [];

    return {
      startNode: startNodeItems,
      resourceLibrary: resourceLibraryItems,
      stepRecord: stepRecordItems,
      resultRecord: resultRecordItems,
    };
  }, [items, nodes]);

  const selectItem = (item: any) => {
    command(item);
  };

  const upHandler = () => {
    const totalItems = items.length;
    setSelectedIndex((selectedIndex + totalItems - 1) % totalItems);
  };

  const downHandler = () => {
    const totalItems = items.length;
    setSelectedIndex((selectedIndex + 1) % totalItems);
  };

  const enterHandler = () => {
    const item = items[selectedIndex];
    if (item) {
      selectItem(item);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedIndex, items]);

  if (items.length === 0) {
    return null;
  }
  return (
    <div
      className="bg-refly-bg-content-z2 rounded-xl shadow-lg border border-refly-Card-Border max-h-64 overflow-hidden min-w-96"
      onMouseLeave={() => {
        setHoveredCategory(null);
      }}
    >
      <div className="flex">
        {/* First level menu - Categories */}
        <div className="w-[174px] border-r border-refly-Card-Border p-2">
          {/* Start Node Category */}
          {groupedItems.startNode.length > 0 && (
            <div
              className="p-1.5 cursor-pointer border-b border-refly-Card-Border transition-colors hover:bg-refly-fill-hover rounded-md"
              onMouseEnter={() => setHoveredCategory('startNode')}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {t('canvas.richChatInput.startNode')}
                </span>
                <svg
                  className="w-3 h-3 text-gray-400 dark:text-gray-500 ml-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Resource Library Category */}
          {(groupedItems.resourceLibrary.length > 0 ||
            groupedItems.stepRecord.length > 0 ||
            groupedItems.resultRecord.length > 0) && (
            <div
              className="p-1.5 cursor-pointer border-b border-refly-Card-Border transition-colors hover:bg-refly-fill-hover rounded-md"
              onMouseEnter={() => {
                setHoveredCategory('resourceLibrary');
                // Reset to uploads when hovering resource library
                setResourceLibraryType('uploads');
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {t('canvas.richChatInput.resourceLibrary')}
                </span>
                <svg
                  className="w-3 h-3 text-gray-400 dark:text-gray-500 ml-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Second level menu - Variables */}
        <div className="flex-1 max-w-[400px]">
          {hoveredCategory === 'startNode' && groupedItems.startNode?.length > 0 && (
            <div className="p-2 max-h-56 overflow-y-auto">
              {groupedItems.startNode.map((item) => (
                <div
                  key={item.name}
                  className="p-1.5 cursor-pointer hover:bg-refly-fill-hover transition-colors rounded-md border-6px"
                  onClick={() => selectItem(item)}
                >
                  <div className="flex items-center gap-2">
                    <img src={SVGX} alt="x" className="w-[10px] h-[10px] flex-shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0 ">
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[100px] dark:text-gray-100">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex">{getStartNodeIcon(item.variableType)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hoveredCategory === 'resourceLibrary' && (
            <>
              {/* Switch button for resource library types */}
              <div className="px-4 py-3 border-b border-refly-Card-Border">
                <div className="flex space-x-1 bg-refly-fill-default rounded-lg p-1">
                  <button
                    type="button"
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all duration-200 whitespace-nowrap min-w-0 relative border-none',
                      resourceLibraryType === 'resultRecord'
                        ? 'bg-refly-bg-content-z2 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100',
                    )}
                    onClick={() => setResourceLibraryType('resultRecord')}
                  >
                    {t('canvas.richChatInput.resultRecord')}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all duration-200 whitespace-nowrap min-w-0 relative border-none',
                      resourceLibraryType === 'stepRecord'
                        ? 'bg-refly-bg-content-z2 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100',
                    )}
                    onClick={() => setResourceLibraryType('stepRecord')}
                  >
                    {t('canvas.richChatInput.stepRecord')}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all duration-200 whitespace-nowrap min-w-0 relative border-none',
                      resourceLibraryType === 'uploads'
                        ? 'bg-refly-bg-content-z2 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100',
                    )}
                    onClick={() => setResourceLibraryType('uploads')}
                  >
                    {t('canvas.richChatInput.myUploads')}
                  </button>
                </div>
              </div>
              <div className="py-2  px-2 max-h-56 overflow-y-auto">
                {resourceLibraryType === 'uploads' &&
                  groupedItems.resourceLibrary?.length > 0 &&
                  groupedItems.resourceLibrary.map((item) => (
                    <div
                      key={item.name}
                      className="p-1.5 cursor-pointer hover:bg-refly-fill-hover transition-colors rounded-md border-6px"
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex items-center gap-3">
                        {getVariableIcon(item.variableType)}
                        <div className="flex flex-col flex-1">
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[100px] dark:text-gray-100">
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                {resourceLibraryType === 'stepRecord' &&
                  groupedItems.stepRecord?.length > 0 &&
                  groupedItems.stepRecord.map((item) => (
                    <div
                      key={item.name}
                      className="p-1.5 cursor-pointer hover:bg-refly-fill-hover transition-colors rounded-md border-6px"
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex items-center gap-3">
                        <AiChat className="bg-[#FC8800] rounded-md p-1" size={20} color="white" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[100px] dark:text-gray-100">
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                {resourceLibraryType === 'resultRecord' &&
                  groupedItems.resultRecord?.length > 0 &&
                  groupedItems.resultRecord.map((item) => (
                    <div
                      key={item.name}
                      className="p-1.5 cursor-pointer hover:bg-refly-fill-hover transition-colors rounded-md border-6px"
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex items-center gap-3">
                        {getVariableIcon(item.variableType)}
                        <div className="flex flex-col flex-1">
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[100px] dark:text-gray-100">
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                {/* Show empty state when no items in selected type */}
                {((resourceLibraryType === 'uploads' &&
                  groupedItems.resourceLibrary?.length === 0) ||
                  (resourceLibraryType === 'stepRecord' && groupedItems.stepRecord?.length === 0) ||
                  (resourceLibraryType === 'resultRecord' &&
                    groupedItems.resultRecord?.length === 0)) && (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    {resourceLibraryType === 'uploads' && t('canvas.richChatInput.noUploadFiles')}
                    {resourceLibraryType === 'stepRecord' &&
                      t('canvas.richChatInput.noStepRecords')}
                    {resourceLibraryType === 'resultRecord' &&
                      t('canvas.richChatInput.noResultRecords')}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Show default view when no category is hovered */}
          {!hoveredCategory && (
            <div className="p-8 text-center text-gray-500 text-sm">
              {t('canvas.richChatInput.hoverToViewVariables')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

      // Get variable type and render the appropriate icon
      // Align logic with MentionList and allItems handling
      const variableType = node.attrs.variableType || node.attrs.source;

      let reactRoot: any = null;
      reactRoot = createRoot(iconContainer);

      reactRoot.render(getVariableIcon(variableType));

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
      variables = [],
      inputClassName,
      handleSendMessage,
      onUploadImage,
      onUploadMultipleImages,
      onFocus,
      contextItems = [],
      setContextItems,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const { nodes } = useCanvasData();
    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));

    // Get all available items including canvas nodes with fallback data
    const allItems = useMemo(() => {
      // Default variables if none provided
      const variableItems =
        variables?.length > 0
          ? variables.filter(
              (variable) =>
                variable.source === 'startNode' || variable.source === 'resourceLibrary',
            )
          : [];

      // Get skillResponse nodes for step records
      const stepRecordItems =
        nodes
          ?.filter((node) => node.type === 'skillResponse')
          ?.map((node) => ({
            name: node.data?.title ?? t('canvas.richChatInput.untitledStep'),
            description: t('canvas.richChatInput.stepRecord'),
            source: 'stepRecord' as const,
            variableType: 'step' as const,
            entityId: node.data?.entityId,
            nodeId: node.id,
          })) ?? [];

      // Get non-skill nodes for result records
      const resultRecordItems =
        nodes
          ?.filter((node) => node.type !== 'skill' && node.type !== 'skillResponse')
          ?.map((node) => ({
            name: node.data?.title ?? t('canvas.richChatInput.untitledResult'),
            description: t('canvas.richChatInput.resultRecord'),
            source: 'resultRecord' as const,
            variableType: 'result' as const,
            entityId: node.data?.entityId,
            nodeId: node.id,
          })) ?? [];

      return [...variableItems, ...stepRecordItems, ...resultRecordItems];
    }, [variables, nodes]);

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
            if (item.source === 'stepRecord' || item.source === 'resultRecord') {
              if (setContextItems && item.entityId) {
                // Create context item
                const contextItem: IContextItem = {
                  entityId: item.entityId,
                  title: item.name,
                  type: item.source === 'stepRecord' ? 'skillResponse' : 'document',
                  metadata: {
                    nodeId: item.nodeId,
                    source: item.source,
                  },
                };

                // Check if already in context
                const isAlreadyInContext = contextItems.some(
                  (ctxItem) => ctxItem.entityId === item.entityId,
                );

                if (!isAlreadyInContext) {
                  setContextItems([...contextItems, contextItem]);
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
            if (!query) {
              return allItems;
            }
            return allItems.filter(
              (item) =>
                item.name.toLowerCase().includes(query.toLowerCase()) ||
                (item.description?.toLowerCase().includes(query.toLowerCase()) ?? false),
            );
          },
          render: () => {
            let component: any;
            let popup: any;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  props,
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
                });
              },
              onUpdate(props: any) {
                component.updateProps(props);

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onExit() {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
        },
      });
    }, [allItems, contextItems, setContextItems]);

    // Create Tiptap editor
    const internalUpdateRef = useRef(false);

    const editor = useEditor({
      extensions: [StarterKit, mentionExtension],
      content: query,
      editable: !readonly,
      onUpdate: ({ editor }) => {
        const content = editor.getText();
        const processedContent = convertMentionsToHandlebars(content);
        internalUpdateRef.current = true;
        setQuery(processedContent);
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
    });

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

            // Only convert startNode and resourceLibrary variables to Handlebars format
            if (mentionName && (source === 'startNode' || source === 'resourceLibrary')) {
              processedContent += `{{${mentionName}}}`;
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
      if (editor.getText() !== (query ?? '')) {
        editor.commands.setContent(query ?? '');
      }
    }, [query, editor]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (readonly) {
          e.preventDefault();
          return;
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
            'w-full h-full flex flex-col flex-grow overflow-y-auto relative',
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
              <EditorContent editor={editor} className="h-full" data-cy="rich-chat-input" />
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

export const RichChatInput = memo(RichChatInputComponent, (prevProps, nextProps) => {
  return (
    prevProps.query === nextProps.query &&
    prevProps.selectedSkillName === nextProps.selectedSkillName &&
    prevProps.variables === nextProps.variables &&
    prevProps.onUploadImage === nextProps.onUploadImage &&
    prevProps.onUploadMultipleImages === nextProps.onUploadMultipleImages &&
    prevProps.onFocus === nextProps.onFocus
  );
}) as typeof RichChatInputComponent;

RichChatInput.displayName = 'RichChatInput';
