import { Button, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { SearchList } from '@refly-packages/ai-workspace-common/modules/entity-selector/components';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { useCanvasStoreShallow } from '@refly/stores';
import { useImportResourceStoreShallow } from '@refly/stores';
import { CanvasNodeType, SearchDomain } from '@refly/openapi-schema';
import { ContextItem } from '@refly-packages/ai-workspace-common/types/context';
import {
  IconPreview,
  IconAskAIInput,
  IconAskAI,
  IconCodeArtifact,
  IconCreateDocument,
  IconDocument,
  IconImportResource,
  IconMemo,
  IconResource,
  IconWebsite,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { IoAnalyticsOutline } from 'react-icons/io5';
import { useEdgeVisible } from '@refly-packages/ai-workspace-common/hooks/canvas/use-edge-visible';
import { genMemoID, genSkillID } from '@refly/utils/id';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { cn } from '@refly/utils/cn';
import { useCreateCodeArtifact } from '@refly-packages/ai-workspace-common/hooks/use-create-code-artifact';
import { logEvent } from '@refly/telemetry-web';

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
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { createSingleDocumentInCanvas, isCreating: isCreatingDocument } = useCreateDocument();
  const { addNode } = useAddNode();

  const [showSearchResourceList, setShowSearchResourceList] = useState(false);
  const [showSearchDocumentList, setShowSearchDocumentList] = useState(false);

  const { setImportResourceModalVisible, setInsertNodePosition } = useImportResourceStoreShallow(
    (state) => ({
      importResourceModalVisible: state.importResourceModalVisible,
      setImportResourceModalVisible: state.setImportResourceModalVisible,
      setInsertNodePosition: state.setInsertNodePosition,
    }),
  );

  const {
    showEdges,
    showLinearThread,
    clickToPreview,
    setShowLinearThread,
    setClickToPreview,
    autoLayout,
    setAutoLayout,
  } = useCanvasStoreShallow((state) => ({
    showEdges: state.showEdges,
    showLinearThread: state.showLinearThread,
    clickToPreview: state.clickToPreview,
    setShowEdges: state.setShowEdges,
    setShowLinearThread: state.setShowLinearThread,
    setClickToPreview: state.setClickToPreview,
    autoLayout: state.autoLayout,
    setAutoLayout: state.setAutoLayout,
  }));

  const { toggleEdgeVisible } = useEdgeVisible();

  // Creation utility functions
  const createSkillNode = (position: { x: number; y: number }) => {
    addNode(
      {
        type: 'skill',
        data: { title: 'Skill', entityId: genSkillID() },
        position: position,
      },
      [],
      true,
      true,
    );
  };

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

  const createCodeArtifactNode = useCreateCodeArtifact();

  const createWebsiteNode = (position: { x: number; y: number }) => {
    addNode(
      {
        type: 'website',
        data: {
          title: t('canvas.nodes.website.defaultTitle', 'Website'),
          entityId: genSkillID(),
          metadata: {
            viewMode: 'form',
          },
        },
        position,
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
      icon: IconAskAI,
      type: 'button',
      primary: true,
      title: t('canvas.toolbar.askAI'),
    },

    { key: 'divider-creation-1', type: 'divider' },
    {
      key: 'createCodeArtifact',
      icon: IconCodeArtifact,
      type: 'button',
      title: t('canvas.toolbar.createCodeArtifact'),
    },
    {
      key: 'createWebsite',
      icon: IconWebsite,
      type: 'button',
      title: t('canvas.toolbar.createWebsite', 'Create Website Node'),
    },
    {
      key: 'createDocument',
      icon: IconCreateDocument,
      type: 'button',
      title: t('canvas.toolbar.createDocument'),
    },
    {
      key: 'createMemo',
      icon: IconMemo,
      type: 'button',
      title: t('canvas.toolbar.createMemo'),
    },
    {
      key: 'addResource',
      icon: IconResource,
      type: 'popover',
      domain: 'resource',
      title: t('canvas.toolbar.addResource'),
      showSearchList: showSearchResourceList,
      setShowSearchList: setShowSearchResourceList,
    },
    {
      key: 'addDocument',
      icon: IconDocument,
      type: 'popover',
      domain: 'document',
      title: t('canvas.toolbar.addDocument'),
      showSearchList: showSearchDocumentList,
      setShowSearchList: setShowSearchDocumentList,
    },
    {
      key: 'importResource',
      icon: IconImportResource,
      type: 'button',
      title: t('canvas.toolbar.importResource'),
    },
    { key: 'divider-settings', type: 'divider' },
    // Settings menu items
    {
      key: 'toggleLaunchpad',
      icon: IconAskAIInput,
      type: 'button',
      active: showLinearThread,
      title: showLinearThread
        ? t('canvas.contextMenu.hideLaunchpad')
        : t('canvas.contextMenu.showLaunchpad'),
      description: t('canvas.contextMenu.toggleLaunchpadDescription'),
      videoUrl:
        'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-toggle-ask-ai.webm',
    },
    {
      key: 'toggleEdges',
      icon: IoAnalyticsOutline,
      type: 'button',
      active: showEdges,
      title: showEdges ? t('canvas.contextMenu.hideEdges') : t('canvas.contextMenu.showEdges'),
      description: t('canvas.contextMenu.toggleEdgeDescription'),
      videoUrl: 'https://static.refly.ai/onboarding/canvas-toolbar/canvas-toolbar-toggle-edge.webm',
    },
    {
      key: 'toggleClickPreview',
      icon: IconPreview,
      type: 'button',
      active: clickToPreview,
      title: clickToPreview
        ? t('canvas.contextMenu.disableClickPreview')
        : t('canvas.contextMenu.enableClickPreview'),
      description: t('canvas.contextMenu.toggleClickPreviewDescription'),
      videoUrl: 'https://static.refly.ai/onboarding/contextMenu/contextMenu-toggleClickView.webm',
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

  const getIsLoading = (key: string) => {
    if (key === 'createDocument' && isCreatingDocument) {
      return true;
    }
    return false;
  };

  const handleMenuClick = async (key: string) => {
    setActiveKey(key);

    // Creation actions
    switch (key) {
      case 'askAI':
        createSkillNode(position);
        setOpen(false);
        break;
      case 'createDocument':
        await createSingleDocumentInCanvas(position);
        setOpen(false);
        break;
      case 'createMemo':
        createMemo(position);
        setOpen(false);
        break;
      case 'createCodeArtifact':
        createCodeArtifactNode({ position });
        setOpen(false);
        break;
      case 'createWebsite':
        createWebsiteNode(position);
        setOpen(false);
        break;
      case 'importResource':
        setInsertNodePosition(position);
        setImportResourceModalVisible(true);
        setOpen(false);
        break;

      // Settings actions
      case 'toggleLaunchpad':
        setShowLinearThread(!showLinearThread);
        setOpen(false);
        break;
      case 'toggleEdges':
        toggleEdgeVisible();
        setOpen(false);
        break;
      case 'toggleClickPreview':
        setClickToPreview(!clickToPreview);
        setOpen(false);
        break;
      case 'toggleAutoLayout':
        setAutoLayout(!autoLayout);
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
      setActiveKey(null);
    };
  }, [open, setOpen]);

  if (!open) return null;

  const renderButton = (item: MenuItem) => {
    const button = (
      <Button
        key={item.key}
        className={cn(
          'w-full h-8 flex items-center gap-2 px-2 rounded text-sm hover:bg-gray-50 transition-colors dark:bg-gray-900',
          {
            'bg-gray-100 dark:bg-gray-800': activeKey === item.key,
            'text-primary-600 dark:text-primary-300': item.primary,
            'text-red-600 dark:text-red-300': item.danger,
            'text-gray-700 dark:text-gray-200': !item.primary && !item.danger,
          },
        )}
        type="text"
        loading={getIsLoading(item.key)}
        icon={item.icon && <item.icon className="flex items-center w-4 h-4" />}
        onClick={() => {
          logEvent('canvas::add_node', Date.now(), {
            node_type: item.key,
          });
          handleMenuClick(item.key);
        }}
      >
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
