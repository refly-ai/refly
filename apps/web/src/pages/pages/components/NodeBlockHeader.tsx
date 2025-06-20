import React, { memo } from 'react';
import { Button, Dropdown, Popconfirm } from 'antd';
import type { MenuProps } from 'antd';
import { MoreHorizontal, X, Trash2 } from 'lucide-react';
import { PlayCircleOutlined } from '@ant-design/icons';
import { type NodeRelation } from './ArtifactRenderer';

import { useTranslation } from 'react-i18next';

interface NodeBlockHeaderProps {
  node: NodeRelation;
  onClose?: () => void;
  onMaximize?: () => void;
  onWideMode?: () => void;
  isMaximized?: boolean;
  isWideMode?: boolean;
  isMinimap?: boolean;
  onDelete?: (nodeId: string) => void;
}

export const NodeBlockHeader: React.FC<NodeBlockHeaderProps> = memo(
  ({ node, onClose, onMaximize, isMaximized = false, isMinimap = false, onDelete }) => {
    const { t } = useTranslation();

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
      <div className="flex justify-end items-center py-2 px-4 border-b border-[#EAECF0] relative">
        <div className="flex items-center gap-1 flex-shrink-0">
          {onMaximize && (
            <Button
              type="text"
              className={`p-1.5 hover:bg-gray-100 ${isMaximized ? 'text-primary-600' : 'text-gray-500'}`}
              onClick={onMaximize}
              title={t('pages.components.nodeBlock.slideshowPreview')}
            >
              <PlayCircleOutlined className="w-4 h-4" />
            </Button>
          )}

          {menuItems?.length > 0 && (
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              placement="bottomRight"
              overlayClassName="min-w-[160px] w-max"
              getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
              dropdownRender={(menu) => (
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
