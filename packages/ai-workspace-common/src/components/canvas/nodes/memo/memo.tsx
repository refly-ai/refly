import { Position, useReactFlow } from '@xyflow/react';
import { CanvasNode, MemoNodeProps } from '../shared/types';
import { CustomHandle } from '../shared/custom-handle';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { getNodeCommonStyles } from '../index';
import { ActionButtons } from '../shared/action-buttons';
import { useTranslation } from 'react-i18next';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';

import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import Moveable from 'react-moveable';
import classNames from 'classnames';
import { useEditor, EditorContent } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import './memo.scss';
import { useThrottledCallback } from 'use-debounce';
import { EditorInstance } from '@refly-packages/ai-workspace-common/components/editor/core/components';
import {
  cleanupNodeEvents,
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useInsertToDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-insert-to-document';
import { MemoEditor } from './memo-editor';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly-packages/utils/id';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useEditorPerformance } from '@refly-packages/ai-workspace-common/context/editor-performance';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const MemoNode = ({
  data,
  selected,
  id,
  isPreview = false,
  hideActions = false,
  hideHandles = false,
  onNodeClick,
}: MemoNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const setNodeDataByEntity = useSetNodeDataByEntity();
  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];
  const { addNode } = useAddNode();

  const { getNode, getEdges } = useReactFlow();
  const node = getNode(id);
  const targetRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    width: node?.measured?.width ?? 288,
    height: node?.measured?.height ?? 284,
  });
  const [isFocused, setIsFocused] = useState(false);
  const { operatingNodeId } = useCanvasStoreShallow((state) => ({
    operatingNodeId: state.operatingNodeId,
  }));
  const { draggingNodeId } = useEditorPerformance();
  const isDragging = draggingNodeId === id;

  const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

  const isOperating = operatingNodeId === id;

  // Check if node has any connections
  const edges = getEdges();
  const isTargetConnected = edges?.some((edge) => edge.target === id);
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  const { readonly } = useCanvasContext();

  // Handle node hover events
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHoverStart();
  }, [onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHoverEnd();
  }, [onHoverEnd]);

  const { addToContext } = useAddToContext();

  const handleAddToContext = useCallback(() => {
    addToContext({
      type: 'memo',
      title: data?.contentPreview
        ? `${data.title} - ${data.contentPreview?.slice(0, 10)}`
        : data.title,
      entityId: data.entityId,
      metadata: data.metadata,
    });
  }, [data, addToContext]);

  const { deleteNode } = useDeleteNode();

  const handleDelete = useCallback(() => {
    deleteNode({
      id,
      type: 'memo',
      data,
      position: { x: 0, y: 0 },
    } as CanvasNode);
  }, [id, data, deleteNode]);

  const insertToDoc = useInsertToDocument(data.entityId);
  const handleInsertToDoc = useCallback(async () => {
    if (!data?.contentPreview) return;
    await insertToDoc('insertBelow', data?.contentPreview);
  }, [insertToDoc, data]);

  const handleAskAI = useCallback(() => {
    addNode(
      {
        type: 'skill',
        data: {
          title: 'Skill',
          entityId: genSkillID(),
          metadata: {
            contextItems: [
              {
                type: 'memo',
                title: data?.contentPreview
                  ? `${data.title} - ${data.contentPreview?.slice(0, 10)}`
                  : data.title,
                entityId: data.entityId,
                metadata: data.metadata,
              },
            ] as IContextItem[],
          },
        },
      },
      [{ type: 'memo', entityId: data.entityId }],
      false,
      true,
    );
  }, [data, addNode]);

  // Add event handling
  useEffect(() => {
    // Create node-specific event handlers
    const handleNodeAddToContext = () => handleAddToContext();
    const handleNodeDelete = () => handleDelete();
    const handleNodeInsertToDoc = () => handleInsertToDoc();
    const handleNodeAskAI = () => handleAskAI();

    // Register events with node ID
    nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
    nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
    nodeActionEmitter.on(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
    nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);

    return () => {
      // Cleanup events when component unmounts
      nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.off(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
      nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);

      // Clean up all node events
      cleanupNodeEvents(id);
    };
  }, [id, handleAddToContext, handleDelete, handleInsertToDoc, handleAskAI]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'highlight',
        },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-500 hover:underline cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        validate: (href) => /^(https?:\/\/|mailto:|tel:)/.test(href),
      }),
      Markdown.configure({
        html: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: t('knowledgeBase.context.memoPlaceholder'),
      }),
    ],
    content: data?.metadata?.jsonContent || data?.contentPreview || '',
    editable: !isPreview && !readonly,
    onUpdate: ({ editor }) => {
      onMemoUpdates(editor);
    },
    onFocus: () => {
      setIsFocused(true);
    },
    onBlur: () => {
      setIsFocused(false);
    },
    editorProps: {
      attributes: {
        class: classNames('max-w-none', 'focus:outline-none'),
      },
      handleDOMEvents: {
        mousedown: (_view, event) => {
          if (selected) {
            event.stopPropagation();
          }
          onNodeClick?.();
          return false;
        },
        click: (_view, event) => {
          if (selected) {
            event.stopPropagation();
          }
          onNodeClick?.();
          return false;
        },
      },
    },
  });

  const onMemoUpdates = useThrottledCallback(async (editor: EditorInstance) => {
    const markdown = editor.storage.markdown.getMarkdown();
    const maxLength = 2000;

    // If content exceeds max length, truncate the content in the editor
    if (markdown.length > maxLength) {
      const truncatedContent = markdown.slice(0, maxLength);
      const currentPos = editor.state.selection.from;

      editor.commands.command(({ tr }) => {
        tr.setMeta('preventSelectionChange', true);
        return true;
      });

      // Truncate the content in the editor
      editor.commands.setContent(truncatedContent);

      if (currentPos <= maxLength) {
        editor.commands.setTextSelection(currentPos);
      }

      // Wait for the editor to update with truncated content
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Now get both markdown and JSON from the editor (which may have been truncated)
    const updatedMarkdown = editor.storage.markdown.getMarkdown();
    const jsonContent = editor.getJSON();

    setNodeDataByEntity(
      {
        entityId: data?.entityId,
        type: 'memo',
      },
      {
        contentPreview: updatedMarkdown,
        metadata: {
          ...data?.metadata,
          jsonContent: jsonContent,
        },
      },
    );
  }, 200);

  const [bgColor, setBgColor] = useState((data?.metadata?.bgColor ?? '#FFFEE7') as string);
  const onUpdateBgColor = useCallback(
    (color: string) => {
      setBgColor(color);
      setNodeDataByEntity(
        {
          entityId: data?.entityId,
          type: 'memo',
        },
        {
          metadata: {
            ...data?.metadata,
            bgColor: color,
          },
        },
      );
    },
    [data?.entityId, data?.metadata, setNodeDataByEntity],
  );

  return (
    <div className={classNames({ nowheel: isFocused && isHovered })}>
      <div
        ref={targetRef}
        onMouseEnter={!isPreview ? handleMouseEnter : undefined}
        onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        className="relative"
        onClick={onNodeClick}
        style={{
          width: `${size.width}px`,
          height: `${size.height}px`,
          userSelect: 'none',
          cursor: readonly ? 'default' : isOperating ? 'default' : 'grab',
        }}
      >
        {!isPreview && selected && !readonly && (
          <MemoEditor editor={editor} bgColor={bgColor} onChangeBackground={onUpdateBgColor} />
        )}
        {!isPreview && !hideActions && !isDragging && !readonly && (
          <ActionButtons type="memo" nodeId={id} isNodeHovered={isHovered && selected} />
        )}

        <div
          style={{ backgroundColor: bgColor }}
          className={`
            h-full
            ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
          `}
        >
          {!isPreview && !hideHandles && (
            <>
              <CustomHandle
                id={`${id}-target`}
                type="target"
                position={Position.Left}
                isConnected={isTargetConnected}
                isNodeHovered={isHovered}
                nodeType="memo"
              />
              <CustomHandle
                id={`${id}-source`}
                type="source"
                position={Position.Right}
                isConnected={isSourceConnected}
                isNodeHovered={isHovered}
                nodeType="memo"
              />
            </>
          )}
          <div className="flex flex-col h-full p-3 box-border">
            <div className="relative flex-grow overflow-y-auto pr-2 -mr-2">
              <div
                className="editor-wrapper"
                style={{ userSelect: 'text', cursor: isPreview || readonly ? 'default' : 'text' }}
              >
                <EditorContent
                  editor={editor}
                  className={classNames('text-xs memo-node-editor h-full w-full')}
                />
              </div>
            </div>

            <div className="flex justify-end items-center flex-shrink-0 mt-2 text-[10px] text-gray-400 z-20">
              {time(data.createdAt, language as LOCALE)
                ?.utc()
                ?.fromNow()}
            </div>
          </div>
        </div>
      </div>

      {!isPreview && selected && !readonly && (
        <Moveable
          target={targetRef}
          resizable={true}
          edge={false}
          throttleResize={1}
          renderDirections={['nw', 'ne', 'sw', 'se']}
          onResizeStart={({ setOrigin, dragStart }) => {
            setOrigin(['%', '%']);
            if (dragStart && dragStart instanceof MouseEvent) {
              dragStart.preventDefault();
            }
          }}
          onResize={({ target, width, height, direction }) => {
            const newWidth = Math.max(200, width);
            const newHeight = Math.max(80, height);

            let newLeft = (target as HTMLElement).offsetLeft;
            let newTop = (target as HTMLElement).offsetTop;

            if (direction[0] === -1) {
              newLeft =
                (target as HTMLElement).offsetLeft -
                (newWidth - (target as HTMLElement).offsetWidth);
            }
            if (direction[1] === -1) {
              newTop =
                (target as HTMLElement).offsetTop -
                (newHeight - (target as HTMLElement).offsetHeight);
            }

            target.style.width = `${newWidth}px`;
            target.style.height = `${newHeight}px`;
            target.style.left = `${newLeft}px`;
            target.style.top = `${newTop}px`;

            setSize({ width: newWidth, height: newHeight });
          }}
          hideDefaultLines={true}
          className={`!pointer-events-auto ${!isHovered ? 'moveable-control-hidden' : 'moveable-control-show'}`}
        />
      )}
    </div>
  );
};
