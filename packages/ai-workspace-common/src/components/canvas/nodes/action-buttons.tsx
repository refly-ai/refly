import { Button, Dropdown, MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  IconReply,
  IconPreview,
  IconRerun,
  IconDelete,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { memo } from 'react';
import { MoreHorizontal, FileInput, Loader2, MessageSquareDiff, FilePlus } from 'lucide-react';
import TooltipWrapper from '@refly-packages/ai-workspace-common/components/common/tooltip-button';
import { addPinnedNodeEmitter } from '@refly-packages/ai-workspace-common/events/addPinnedNode';
// Action button types
type ActionButtonProps = {
  icon: React.ReactNode;
  onClick: (e: any) => void;
  loading?: boolean;
  tooltip?: string;
  withTooltip?: boolean;
};

// Action button with memoization
const ActionButton = memo((props: ActionButtonProps) => {
  const { withTooltip = true, icon, onClick, loading } = props;

  const button = (
    <Button
      className="
    p-2
    rounded-lg
    bg-white
    hover:bg-gray-50
    text-[rgba(0,0,0,0.5)]
    transition-colors
    duration-200
    disabled:opacity-50
    disabled:cursor-not-allowed
  "
      type="text"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    </Button>
  );

  return withTooltip ? (
    <TooltipWrapper tooltip={props.tooltip} placement="top">
      {button}
    </TooltipWrapper>
  ) : (
    button
  );
});

type ActionButtonsProps = {
  nodeId: string;
  type: 'document' | 'resource' | 'skill-response';
  onAddToContext?: () => void;
  onAddToChatHistory?: () => void;
  onRerun?: () => void;
  onInsertToDoc?: () => void;
  onDelete?: () => void;
  onHelpLink?: () => void;
  onAbout?: () => void;
  isProcessing?: boolean;
  isCompleted?: boolean;
  onCreateDocument?: () => void;
  isCreatingDocument?: boolean;
};

type MenuItem = {
  icon?: React.ReactNode;
  label?: string;
  onClick?: () => void;
  loading?: boolean;
  danger?: boolean;
  type: 'button' | 'divider';
};

// Memoized action buttons container
export const ActionButtons = memo(
  ({
    type,
    nodeId,
    onAddToContext,
    onAddToChatHistory,
    onRerun,
    onInsertToDoc,
    onDelete,
    onHelpLink,
    onAbout,
    isProcessing,
    isCompleted,
    onCreateDocument,
    isCreatingDocument,
  }: ActionButtonsProps) => {
    const { t } = useTranslation();

    const { addPinnedNode } = useCanvasStoreShallow((state) => ({
      addPinnedNode: state.addPinnedNode,
    }));
    const { getNode } = useReactFlow();
    const { canvasId } = useCanvasContext();

    const menuItems: MenuItem[] = [
      {
        type: 'button',
        icon: <IconPreview className="w-4 h-4" />,
        label: t('canvas.nodeActions.preview'),
        onClick: () => {
          addPinnedNode(canvasId, getNode(nodeId) as CanvasNode<any>);
          addPinnedNodeEmitter.emit('addPinnedNode', { id: nodeId, canvasId });
        },
      },
      { type: 'divider' },
      // Document and Resource specific actions
      ...(type === 'document' || type === 'resource'
        ? [
            {
              type: 'button',
              icon: <MessageSquareDiff className="w-4 h-4" />,
              label: t('canvas.nodeActions.addToContext'),
              onClick: onAddToContext,
            },
            // Resource specific loading state
            ...(type === 'resource' && isProcessing
              ? [
                  {
                    type: 'button',
                    icon: <Loader2 className="w-4 h-4" />,
                    label: t('canvas.nodeActions.processingVector'),
                    loading: true,
                  },
                ]
              : []),
          ]
        : []),
      // Skill response specific actions
      ...(type === 'skill-response'
        ? [
            isCompleted && {
              type: 'button',
              icon: <IconRerun className="w-4 h-4" />,
              label: t('canvas.nodeActions.rerun'),
              onClick: onRerun,
            },
            {
              type: 'button',
              icon: <FileInput className="w-4 h-4" />,
              label: t('canvas.nodeActions.insertToDoc'),
              onClick: onInsertToDoc,
            },
            {
              type: 'button',
              icon: <MessageSquareDiff className="w-4 h-4" />,
              label: t('canvas.nodeActions.addToContext'),
              onClick: onAddToChatHistory,
            },
            onCreateDocument && {
              type: 'button',
              icon: <FilePlus className="w-4 h-4" />,
              label: t('canvas.nodeStatus.createDocument'),
              onClick: onCreateDocument,
              loading: isCreatingDocument,
            },
          ].filter(Boolean)
        : []),
      { type: 'divider' },
      {
        type: 'button',
        icon: <IconDelete className="w-4 h-4" />,
        label: t('canvas.nodeActions.delete'),
        onClick: onDelete,
        danger: true,
      },
    ].filter(Boolean) as MenuItem[];

    return (
      <div
        className="
          absolute
          -right-[154px]
          top-0
          opacity-0
          group-hover:opacity-100
          transition-opacity
          duration-200
          ease-in-out
          z-50
          w-[150px]
          bg-white
          rounded-lg
          border
          border-[rgba(0,0,0,0.06)]
          shadow-[0px_4px_6px_-2px_rgba(16,24,40,0.03),0px_12px_16px_-4px_rgba(16,24,40,0.08)]
          p-2
        "
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {menuItems.map((item, index) => {
          if (item.type === 'divider') {
            return <div key={`divider-${index}`} className="my-1 h-[1px] bg-gray-100" />;
          }

          return (
            <Button
              key={index}
              type="text"
              className={`
                w-full
                h-8
                flex
                items-center
                gap-2
                px-2
                rounded
                text-sm
                transition-colors
                ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}
                ${item.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              onClick={item.onClick}
              disabled={item.loading}
            >
              {item.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : item.icon}
              <span className="flex-1 text-left truncate">{item.label}</span>
            </Button>
          );
        })}
      </div>
    );
  },
);
