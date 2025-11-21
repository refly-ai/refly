import React, { useCallback, useMemo } from 'react';
import { Button, message } from 'antd';
import { SelectionBubble } from './selection-bubble';
import { useTranslation } from 'react-i18next';
import { useSelectionContext } from './use-selection-context';
import { useCreateMemo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-memo';
import { IContextItem } from '@refly/common-types';
import { useReactFlow } from '@xyflow/react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';

interface SelectionContextProps {
  containerClass?: string;
  getContextItem: (text: string) => IContextItem;
  getSourceNode?: () => { type: CanvasNodeType; entityId: string } | null;
}

export const SelectionContext = React.memo<SelectionContextProps>(
  ({ containerClass, getContextItem, getSourceNode }) => {
    const { t } = useTranslation();
    const { selectedText, addToContext, removeSelection } = useSelectionContext({
      containerClass,
    });
    const { getNodes } = useReactFlow();
    const { addNode } = useAddNode();

    const { createMemo } = useCreateMemo();

    const handleCreateMemo = useCallback(
      (selectedText: string) => {
        const sourceNode = getSourceNode?.();
        if (sourceNode) {
          const nodes = getNodes();
          const node = nodes.find((n) => n.data?.entityId === sourceNode.entityId);
          if (node) {
            createMemo({
              content: selectedText,
              position: {
                x: node.position.x + 300,
                y: node.position.y,
              },
              sourceNode,
            });
          } else {
            createMemo({
              content: selectedText,
              sourceNode,
            });
          }
        } else {
          createMemo({
            content: selectedText,
          });
        }
        removeSelection();
      },
      [getSourceNode, createMemo, getNodes, removeSelection],
    );

    const handleAddToContext = useCallback(
      (text: string) => {
        const item = getContextItem(text);
        addToContext(item);
      },
      [getContextItem, addToContext],
    );

    const handleCreateAskAI = useCallback(
      (text: string) => {
        const contextItem = getContextItem(text);

        addNode(
          {
            type: 'skill',
            data: {
              title: 'Skill',
              entityId: genSkillID(),
              metadata: {
                contextItems: [contextItem],
              },
            },
          },
          contextItem.selection?.sourceEntityId
            ? [
                {
                  type: contextItem.selection.sourceEntityType as CanvasNodeType,
                  entityId: contextItem.selection.sourceEntityId,
                },
              ]
            : [],
          false,
          true,
        );

        removeSelection();
        message.success(t('knowledgeBase.context.createAskAISuccess'));
      },
      [getContextItem, addNode, removeSelection, t],
    );

    const buttons = useMemo(
      () => [
        // {
        //   className:
        //     'w-full px-2 py-0 font-medium text-sm justify-start !text-[#0E9F77] hover:!text-[#0E9F77]/80',
        //   icon: <IconQuote size={14} />,
        //   label: t('knowledgeBase.context.addToContext'),
        //   onClick: () => handleAddToContext(selectedText),
        // },
        /*{
          className: 'w-full px-2 py-0 text-sm justify-start',
          icon: <IconMemo size={14} />,
          label: t('knowledgeBase.context.createMemo'),
          onClick: () => handleCreateMemo(selectedText),
        },
        {
          className: 'w-full px-2 py-0 text-sm justify-start',
          icon: <IconResponse size={14} />,
          label: t('knowledgeBase.context.createAskAI'),
          onClick: () => handleCreateAskAI(selectedText),
        },*/
      ],
      [t, handleAddToContext, handleCreateMemo, handleCreateAskAI, selectedText],
    );

    return (
      <SelectionBubble containerClass={containerClass} placement="top" offset={[0, 10]}>
        <div
          className="refly-selector-hover-menu flex flex-col bg-white dark:bg-black shadow-sm shadow-gray-300/80 dark:shadow-gray-700/80 rounded-md"
          style={{ padding: '2px 4px' }}
        >
          {buttons.map((button, index) => (
            <Button
              key={index}
              type="text"
              className={button.className}
              icon={button.icon}
              onMouseDown={(e) => {
                // Prevent selection from being cleared
                e.preventDefault();
                e.stopPropagation();
                button.onClick();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </SelectionBubble>
    );
  },
  (prevProps, nextProps) => prevProps.containerClass === nextProps.containerClass,
);

SelectionContext.displayName = 'SelectionContext';
