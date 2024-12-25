import { Button, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { HiOutlineDocumentAdd } from 'react-icons/hi';
import { PiShootingStar } from 'react-icons/pi';
import { RiUploadCloud2Line } from 'react-icons/ri';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/use-create-document';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';

interface ContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  setOpen: (open: boolean) => void;
}

interface MenuItem {
  key: string;
  icon?: React.ElementType;
  type: 'button' | 'divider';
}

export const ContextMenu: FC<ContextMenuProps> = ({ open, position, setOpen }) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuHeight, setMenuHeight] = useState<number>(0);
  const { createSingleDocumentInCanvas, isCreating } = useCreateDocument();
  const { setImportResourceModalVisible, setInsertNodePosition } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
    setInsertNodePosition: state.setInsertNodePosition,
  }));

  const menuItems: MenuItem[] = [
    { key: 'createDocument', icon: HiOutlineDocumentAdd, type: 'button' },
    { key: 'divider-1', type: 'divider' },
    { key: 'askAI', icon: PiShootingStar, type: 'button' },
    { key: 'importResource', icon: RiUploadCloud2Line, type: 'button' },
  ];

  const adjustPosition = (x: number, y: number) => {
    const menuWidth = 200;
    const padding = 10;

    // Get window dimensions
    const windowWidth = window?.innerWidth ?? 0;
    const windowHeight = window?.innerHeight ?? 0;

    // Adjust X position if menu would overflow right side
    const adjustedX = Math.min(x, windowWidth - menuWidth - padding);

    // Use actual menu height for calculations
    const adjustedY = Math.min(y, windowHeight - menuHeight - padding);

    return {
      x: Math.max(padding, adjustedX),
      y: Math.max(padding, adjustedY),
    };
  };

  const getMenuScreenPosition = () => {
    const reactFlowInstance = useReactFlow();
    const screenPosition = reactFlowInstance.flowToScreenPosition(position);
    return adjustPosition(screenPosition.x, screenPosition.y);
  };

  const menuScreenPosition = getMenuScreenPosition();

  const handleMenuClick = async (key: string) => {
    switch (key) {
      case 'createDocument':
        await createSingleDocumentInCanvas(t('common.newDocument'), '', {
          addToCanvas: true,
        });
        break;
      case 'askAI':
        // TODO: Handle ask AI
        break;
      case 'importResource':
        setInsertNodePosition(position);
        setImportResourceModalVisible(true);
        break;
    }
    setOpen(false);
  };

  // Update menu height when menu opens or content changes
  useEffect(() => {
    if (open && menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [open, menuItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white rounded-lg shadow-lg p-2 w-[200px] border border-[rgba(0,0,0,0.06)]"
      style={{
        left: `${menuScreenPosition.x}px`,
        top: `${menuScreenPosition.y}px`,
      }}
    >
      {menuItems.map((item) => {
        if (item.type === 'divider') {
          return <Divider key={item.key} className="my-1 h-[1px] bg-gray-100" />;
        }

        const isLoading = item.key === 'createDocument' && isCreating;

        return (
          <Button
            key={item.key}
            className="w-full h-8 flex items-center gap-2 px-2 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            type="text"
            loading={isLoading}
            icon={item.icon && <item.icon className="flex items-center w-4 h-4" />}
            onClick={() => handleMenuClick(item.key)}
          >
            <span className="flex-1 text-left truncate">{t(`canvas.contextMenu.${item.key}`)}</span>
          </Button>
        );
      })}
    </div>
  );
};
