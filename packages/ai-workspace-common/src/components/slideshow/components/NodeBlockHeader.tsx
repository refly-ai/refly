import React, { memo, useCallback } from 'react';
import { Button, Dropdown, Popconfirm } from 'antd';
import type { MenuProps } from 'antd';
import { MoreHorizontal, X, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { NodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-header';
import { type NodeRelation } from './ArtifactRenderer';
import { IconWideMode } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType } from '@refly/openapi-schema';

// Get node title
const getNodeTitle = (node: NodeRelation) => {
  const { t } = useTranslation();
  return node.nodeData?.title || t('common.agent', { defaultValue: 'Agent' });
};

interface NodeBlockHeaderProps {
  node: NodeRelation;
  onClose?: () => void;
  onMaximize?: () => void;
  onWideMode?: () => void;
  isMaximized?: boolean;
  isWideMode?: boolean;
  isMinimap?: boolean;
  onDelete?: (nodeId: string) => void;
  isFullscreen?: boolean;
  isModal?: boolean;
  rightActions?: React.ReactNode;
  // Allow parent to customize NodeHeader styles (e.g., override background)
  nodeHeaderClassName?: string;
}

export const NodeBlockHeader: React.FC<NodeBlockHeaderProps> = memo(
  ({
    node,
    onClose,
    onMaximize,
    onWideMode,
    isMaximized = false,
    isWideMode = false,
    isMinimap = false,
    onDelete,
    rightActions,
    nodeHeaderClassName,
  }) => {
    const { t } = useTranslation();
    const title = getNodeTitle(node);

    // Handle title update
    const handleTitleUpdate = useCallback((newTitle: string) => {
      // Logic for title update can be added here
      console.log('Title updated:', newTitle);
    }, []);

    // Define dropdown menu items
    const menuItems: MenuProps['items'] = onDelete
      ? [
          {
            key: 'delete',
            label: (
              <Popconfirm
                title={t('pages.components.nodeBlock.confirmDelete')}
                description={t('pages.components.nodeBlock.confirmDeleteContent')}
                onConfirm={() => onDelete(node.nodeId)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true }}
              >
                <div className="flex items-center gap-2 text-red-600 whitespace-nowrap">
                  <Trash2 className="w-4 h-4 flex-shrink-0" />
                  <span>{t('pages.components.nodeBlock.deleteNode')}</span>
                </div>
              </Popconfirm>
            ),
          },
        ]
      : [];

    // If in minimap mode, don't display header
    if (isMinimap) {
      return null;
    }

    return (
      <div className="flex justify-between items-center py-4 px-3 rounded-lg relative">
        {/* Left: Icon and Title */}
        <div className="flex items-center gap-2 flex-grow overflow-hidden h-5">
          <div className="flex-grow overflow-hidden">
            <NodeHeader
              source="preview"
              title={title}
              type={node.nodeType as CanvasNodeType}
              resourceType={node.nodeData?.metadata?.resourceType as any}
              canEdit={false}
              updateTitle={handleTitleUpdate}
              className={nodeHeaderClassName}
            />
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0 h-5">
          {rightActions}
          {onWideMode && (
            <Button
              type="text"
              className={`p-1.5 hover:bg-gray-100 ${isWideMode ? 'text-primary-600' : 'text-gray-500'}`}
              onClick={onWideMode}
              title={t('pages.components.nodeBlock.wideModeView')}
            >
              <IconWideMode className="w-4 h-4" />
            </Button>
          )}
          {onMaximize && (
            <Button
              type="text"
              className={`p-1.5 hover:bg-gray-100 ${isMaximized ? 'text-primary-600' : 'text-gray-500'}`}
              onClick={onMaximize}
              title={t('pages.components.nodeBlock.slideshowPreview')}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}

          {menuItems?.length > 0 && (
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              placement="bottomRight"
              overlayClassName="min-w-[160px] w-max"
              getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              popupRender={(menu) => (
                <div className="min-w-[160px] bg-white rounded-lg border-[0.5px] border-[rgba(0,0,0,0.03)] shadow-lg">
                  {menu}
                </div>
              )}
            >
              <Button type="text" className="p-1.5 hover:bg-gray-100 text-gray-500">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </Dropdown>
          )}
          {onClose && (
            <Button type="text" className="p-1.5 hover:bg-gray-100 text-gray-500" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  },
);

NodeBlockHeader.displayName = 'NodeBlockHeader';
