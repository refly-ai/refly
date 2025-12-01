import { Button, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { SearchList } from '@refly-packages/ai-workspace-common/modules/entity-selector/components';
import { CanvasNodeType, SearchDomain } from '@refly/openapi-schema';
import { ContextItem } from '@refly-packages/ai-workspace-common/types/context';
import { AiChat, Substrsct } from 'refly-icons';
import { genMemoID } from '@refly/utils/id';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { logEvent } from '@refly/telemetry-web';
import { useAddAgentGlobal } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-agent-global';

interface ContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  setOpen: (open: boolean) => void;
  isSelection?: boolean;
  onCreateGroup?: () => void;
}

interface MenuItem {
  key: string;
  icon?: React.ElementType;
  type: 'button' | 'divider' | 'popover';
  active?: boolean;
  title?: string;
  description?: string;
  videoUrl?: string;
  primary?: boolean;
  danger?: boolean;
  domain?: string;
  showSearchList?: boolean;
  setShowSearchList?: (show: boolean) => void;
}

export const ContextMenu: FC<ContextMenuProps> = ({ open, position, setOpen }) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuHeight, setMenuHeight] = useState<number>(0);
  const { addNode } = useAddNode();
  const { addGlobalAgent } = useAddAgentGlobal();

  const createMemo = (position: { x: number; y: number }) => {
    const memoId = genMemoID();
    addNode(
      {
        type: 'memo',
        data: { title: t('canvas.nodeTypes.memo'), entityId: memoId },
        position: position,
      },
      [],
      true,
      true,
    );
  };

  // Combined menu items
  const menuItems: MenuItem[] = [
    // Creation menu items
    {
      key: 'askAI',
      icon: AiChat,
      type: 'button',
      title: t('canvas.toolbar.askAI'),
    },
    {
      key: 'createMemo',
      icon: Substrsct,
      type: 'button',
      title: t('canvas.toolbar.createMemo'),
    },
  ];

  const handleConfirm = (selectedItems: ContextItem[]) => {
    if (selectedItems.length > 0) {
      const domain = selectedItems[0]?.domain;
      selectedItems.forEach((item, index) => {
        const nodePosition = {
          x: position.x + index * 300,
          y: position.y,
        };
        const contentPreview = item?.snippets?.map((snippet) => snippet?.text || '').join('\n');
        addNode({
          type: domain as CanvasNodeType,
          data: {
            title: item.title,
            entityId: item.id,
            contentPreview: item?.contentPreview || contentPreview,
          },
          position: nodePosition,
        });
      });
      setOpen(false);
    }
  };

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
    // Creation actions
    switch (key) {
      case 'askAI':
        addGlobalAgent({ position });
        setOpen(false);
        break;
      case 'createMemo':
        createMemo(position);
        setOpen(false);
        break;
    }
  };

  // Update menu height when menu opens or content changes
  useEffect(() => {
    if (open && menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [open, menuItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isInsideMenuPopper = menuRef.current?.contains(target);
      const isInsidePopover = target.closest('.canvas-search-list');

      if (open && !isInsideMenuPopper && !isInsidePopover) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, setOpen]);

  if (!open) return null;

  const renderButton = (item: MenuItem) => {
    const button = (
      <Button
        key={item.key}
        className="w-full h-8 flex items-center gap-2 px-2 rounded text-sm hover:bg-refly-tertiary-hover"
        type="text"
        loading={false}
        onClick={() => {
          logEvent('canvas::add_node', Date.now(), {
            node_type: item.key,
          });
          handleMenuClick(item.key);
        }}
      >
        {item.icon && <item.icon size={18} className="flex items-center w-4.5 h-4.5" />}
        <span className="flex-1 text-left truncate">{item.title}</span>
      </Button>
    );

    return button;
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white rounded-lg shadow-lg p-2 w-[200px] border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] dark:bg-gray-900"
      style={{
        left: `${menuScreenPosition.x}px`,
        top: `${menuScreenPosition.y}px`,
      }}
    >
      {menuItems.map((item) => {
        if (item.type === 'divider') {
          return <Divider key={item.key} className="my-1 h-[1px] bg-gray-100 dark:bg-gray-900" />;
        }

        if (item.type === 'popover') {
          return (
            <SearchList
              className="canvas-search-list"
              key={item.key}
              domain={item.domain as SearchDomain}
              handleConfirm={handleConfirm}
              offset={12}
              placement="right"
              open={item.showSearchList ?? false}
              setOpen={item.setShowSearchList ?? (() => {})}
            >
              <div key={`wrapper-${item.key}`} className="flex items-center w-full">
                {renderButton(item)}
              </div>
            </SearchList>
          );
        }

        return (
          <div key={`wrapper-${item.key}`} className="flex items-center w-full">
            {renderButton(item)}
          </div>
        );
      })}
    </div>
  );
};
