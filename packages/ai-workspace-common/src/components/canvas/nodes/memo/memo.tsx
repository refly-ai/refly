import { useReactFlow, NodeResizer } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { MemoNodeProps } from '../shared/types';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { getNodeCommonStyles } from '../shared/styles';
import { useTranslation } from 'react-i18next';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';

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
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID, genMemoID } from '@refly/utils/id';
import { IContextItem } from '@refly/common-types';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useNodeSize } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { Button, Dropdown, type MenuProps } from 'antd';
import { More, Delete, Edit } from 'refly-icons';
import { cn } from '@refly/utils/cn';

export const MemoNode = ({ data, selected, id, isPreview = false, onNodeClick }: MemoNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const setNodeDataByEntity = useSetNodeDataByEntity();
  const { t } = useTranslation();
  const { addNode } = useAddNode();
  useSelectedNodeZIndex(id, selected);

  const { getNode } = useReactFlow();
  const node = getNode(id);
  const targetRef = useRef<HTMLDivElement>(null);
  const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();

  const [isFocused, setIsFocused] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

  const { readonly } = useCanvasContext();

  const { updateSize } = useNodeSize({
    id,
    node: node ?? {
      id,
      position: { x: 0, y: 0 },
      data: {},
      type: 'memo',
    },
    sizeMode: 'adaptive',
    readonly,
    isOperating: false,
    minWidth: 150,
    maxWidth: 800,
    minHeight: 150,
    defaultWidth: 230,
    defaultHeight: 200,
  });

  // Handle resize with ReactFlow NodeResizer
  const handleResize = useCallback(
    (_event: any, params: any) => {
      const { width, height } = params;
      updateSize({ width, height });
    },
    [updateSize],
  );

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

  const handleAskAI = useCallback(
    (event?: {
      dragCreateInfo?: NodeDragCreateInfo;
    }) => {
      const { position, connectTo } = getConnectionInfo(
        { entityId: data.entityId, type: 'memo' },
        event?.dragCreateInfo,
      );

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
          position,
        },
        connectTo,
        false,
        true,
      );
    },
    [data, addNode, getConnectionInfo],
  );

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

  // Panel color tokens
  const panelColors = useMemo(() => ['#FEF2CF', '#F4EEFF', '#EAF4FF', '#FFEFED', '#F6F6F6'], []);

  const [bgColor, setBgColor] = useState((data?.metadata?.bgColor ?? panelColors[0]) as string);
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

  // Dropdown menu items
  const dropdownItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'panel-color',
        label: (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <Edit size={16} />
              <span className="text-sm">{t('knowledgeBase.context.panelColor')}</span>
            </div>
            <div className="flex items-center gap-2">
              {panelColors.map((color) => (
                <div
                  key={color}
                  className="flex items-center justify-center rounded-full w-5 h-5 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateBgColor(color);
                  }}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-solid border-[2px] box-border hover:border-refly-text-2 ${
                      bgColor === color ? 'border-refly-text-2' : 'border-refly-Card-Border'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        label: (
          <div className="flex items-center gap-2">
            <Delete size={16} />
            <span className="text-sm">{t('common.delete')}</span>
          </div>
        ),
        onClick: () => {
          handleDelete();
        },
      },
    ],
    [bgColor, panelColors, t, onUpdateBgColor, handleDelete],
  );

  const handleDuplicate = useCallback(
    (event?: {
      dragCreateInfo?: NodeDragCreateInfo;
    }) => {
      const memoId = genMemoID();
      const jsonContent = editor?.getJSON();
      const content = editor?.storage?.markdown?.getMarkdown() || data?.contentPreview || '';

      const { position, connectTo } = getConnectionInfo(
        { entityId: data.entityId, type: 'memo' },
        event?.dragCreateInfo,
      );

      addNode(
        {
          type: 'memo',
          data: {
            title: t('canvas.nodeTypes.memo'),
            contentPreview: content,
            entityId: memoId,
            metadata: {
              bgColor: data?.metadata?.bgColor || '#FFFEE7',
              jsonContent,
            },
          },
          position,
        },
        connectTo,
        false,
        true,
      );
    },
    [data, addNode, editor, t, getConnectionInfo],
  );

  // Add event handling
  useEffect(() => {
    // Create node-specific event handlers
    const handleNodeAddToContext = () => handleAddToContext();
    const handleNodeDelete = () => handleDelete();
    const handleNodeInsertToDoc = () => handleInsertToDoc();
    const handleNodeAskAI = (event?: {
      dragCreateInfo?: NodeDragCreateInfo;
    }) => handleAskAI(event);
    const handleNodeDuplicate = (event?: {
      dragCreateInfo?: NodeDragCreateInfo;
    }) => handleDuplicate(event);

    // Register events with node ID
    nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
    nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
    nodeActionEmitter.on(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
    nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);
    nodeActionEmitter.on(createNodeEventName(id, 'duplicate'), handleNodeDuplicate);

    return () => {
      // Cleanup events when component unmounts
      nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.off(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
      nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);
      nodeActionEmitter.off(createNodeEventName(id, 'duplicate'), handleNodeDuplicate);

      // Clean up all node events
      cleanupNodeEvents(id);
    };
  }, [id, handleAddToContext, handleDelete, handleInsertToDoc, handleAskAI, handleDuplicate]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={targetRef}
        onMouseEnter={!isPreview ? handleMouseEnter : undefined}
        onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        className={classNames('w-full h-full rounded-lg relative', {
          nowheel: isFocused && isHovered,
        })}
        onClick={onNodeClick}
        style={
          isPreview
            ? {
                width: 288,
                height: 200,
              }
            : null
        }
      >
        <div
          style={{ backgroundColor: bgColor }}
          onClick={() => {
            editor?.commands.focus('end');
          }}
          className={`
            h-full
            w-full
            relative
            z-1
            flex flex-col h-full box-border
            px-[10px]
            pt-3
            pb-1
            ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
          `}
        >
          <div className="relative flex-grow overflow-y-auto">
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
          <div className="flex items-center justify-between h-6 p-1 pr-0">
            <Logo
              textProps={{ show: true, className: 'w-[27px]', fillColor: '#1C1F23', opacity: 0.3 }}
              logoProps={{ show: false }}
            />

            {!readonly && (
              <Dropdown
                menu={{ items: dropdownItems }}
                trigger={['click']}
                placement="bottomLeft"
                arrow={false}
                open={dropdownOpen}
                onOpenChange={setDropdownOpen}
                getPopupContainer={() => targetRef.current}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<More size={14} color="#1C1F23" />}
                  className={cn(
                    '!h-[18px] !w-[18px] flex items-center justify-center hover:!bg-[#00000014]',
                    dropdownOpen && '!bg-[#00000014]',
                  )}
                />
              </Dropdown>
            )}
          </div>
        </div>
      </div>
      {!isPreview && selected && !readonly && (
        <NodeResizer
          minWidth={150}
          maxWidth={800}
          minHeight={150}
          maxHeight={1200}
          onResize={handleResize}
        />
      )}
    </div>
  );
};
