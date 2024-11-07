import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tabs, Tooltip, Splitter, Dropdown, MenuProps } from 'antd';

import { ResourceView } from '../resource-view';
import { CanvasEditor } from '../canvas';
import { useProjectTabs } from '@refly-packages/ai-workspace-common/hooks/use-project-tabs';
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import { useReferencesStoreShallow } from '@refly-packages/ai-workspace-common/stores/references';
import { useNewCanvasModalStoreShallow } from '@refly-packages/ai-workspace-common/stores/new-canvas-modal';
import { HiMagnifyingGlass } from 'react-icons/hi2';
import { PiPlusBold } from 'react-icons/pi';

import { closestCenter, DndContext } from '@dnd-kit/core';
import { DragEndEvent, PointerSensor, useSensor } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ResourceDeck from '@refly-packages/ai-workspace-common/components/project-detail/resource-view/resource-deck';
import { useJumpNewPath } from '@refly-packages/ai-workspace-common/hooks/use-jump-new-path';

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  'data-node-key': string;
}

const DraggableTabNode = ({ className, children, ...props }: DraggableTabPaneProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: props['data-node-key'],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    display: 'inline-flex',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

export const ContentArea = (props: { projectId: string; setBindResourceModalVisible: (visible: boolean) => void }) => {
  const { projectId, setBindResourceModalVisible } = props;
  const { t } = useTranslation();

  const { tabsMap, activeTabMap, setProjectTabs, setActiveTab, handleDeleteTab } = useProjectTabs();
  const { jumpToCanvas, jumpToResource } = useJumpNewPath();
  const tabs = tabsMap[projectId] || [];
  const activeTab = tabs.find((x) => x.key === activeTabMap[projectId]);

  const searchStore = useSearchStoreShallow((state) => ({
    pages: state.pages,
    setPages: state.setPages,
    setIsSearchOpen: state.setIsSearchOpen,
  }));

  const newCanvasModalStore = useNewCanvasModalStoreShallow((state) => ({
    setNewCanvasModalVisible: state.setNewCanvasModalVisible,
    setSelectedProjectId: state.setSelectedProjectId,
  }));

  const tabItems = tabs.map((item) => ({
    key: item.key,
    label: item.title,
  }));

  const onChange = (newActiveKey: string) => {
    setActiveTab(projectId, newActiveKey);
    const tab = tabs.find((x) => x.key === newActiveKey);
    if (tab?.type === 'canvas') {
      jumpToCanvas({
        canvasId: tab.key,
        projectId,
      });
    } else if (tab?.type === 'resource') {
      jumpToResource({
        resId: tab.key,
        projectId,
      });
    }
  };

  const onEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'add') {
      console.log('add');
    } else {
      handleDeleteTab(projectId, targetKey as string);
    }
  };

  const sensor = useSensor(PointerSensor, { activationConstraint: { distance: 0 } });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((item) => item.key === active.id);
      const newIndex = tabs.findIndex((item) => item.key === over.id);

      setProjectTabs(projectId, arrayMove(tabs, oldIndex, newIndex));
    }
  };

  const { deckSize, setDeckSize } = useReferencesStoreShallow((state) => ({
    deckSize: state.deckSize,
    setDeckSize: state.setDeckSize,
  }));

  useEffect(() => {
    setDeckSize(0);
  }, [activeTab]);

  const handleAddNewCanvas = () => {
    newCanvasModalStore.setSelectedProjectId(projectId);
    newCanvasModalStore.setNewCanvasModalVisible(true);
  };

  const handleAddNewResource = () => {
    setBindResourceModalVisible(true);
  };

  const items: MenuProps['items'] = [
    {
      key: 'addCanvas',
      label: (
        <div className="flex items-center" onClick={handleAddNewCanvas}>
          {t('projectDetail.contentArea.addCanvas')}
        </div>
      ),
    },
    {
      key: 'addResource',
      label: (
        <div className="flex items-center" onClick={handleAddNewResource}>
          {t('projectDetail.contentArea.addResource')}
        </div>
      ),
    },
  ];

  return (
    <div className="h-full relative flex flex-col">
      <Tabs
        tabBarStyle={{ marginBottom: 0 }}
        animated
        type="editable-card"
        size="middle"
        items={tabItems}
        activeKey={activeTab?.key}
        onChange={onChange}
        onEdit={onEdit}
        addIcon={
          <Dropdown menu={{ items }} placement="bottomLeft">
            <div className="h-[40px] w-[24px] flex items-center justify-center">
              <PiPlusBold />
            </div>
          </Dropdown>
        }
        renderTabBar={(tabBarProps, DefaultTabBar) => (
          <DndContext sensors={[sensor]} onDragEnd={onDragEnd} collisionDetection={closestCenter}>
            <SortableContext items={tabs.map((tab) => tab.key)} strategy={horizontalListSortingStrategy}>
              <DefaultTabBar {...tabBarProps}>
                {(node) => (
                  <DraggableTabNode {...node.props} key={node.key}>
                    {node}
                  </DraggableTabNode>
                )}
              </DefaultTabBar>
            </SortableContext>
          </DndContext>
        )}
        tabBarExtraContent={
          <Tooltip title={t('knowledgeBase.header.searchAndOpenResourceOrProject')}>
            <Button
              icon={<HiMagnifyingGlass />}
              type="text"
              onClick={() => {
                searchStore.setPages(searchStore.pages.concat('readResources'));
                searchStore.setIsSearchOpen(true);
              }}
            />
          </Tooltip>
        }
      />
      <div className="flex-grow overflow-auto overflow-hidden">
        <Splitter
          layout="vertical"
          onResize={(sizes) => {
            setDeckSize(sizes[1]);
          }}
        >
          <Splitter.Panel>
            {activeTab?.type === 'canvas' ? (
              <CanvasEditor projectId={projectId} canvasId={activeTab?.key} />
            ) : (
              <ResourceView projectId={projectId} resourceId={activeTab?.key} />
            )}
          </Splitter.Panel>
          {activeTab && (
            <Splitter.Panel size={deckSize} max={'80%'} collapsible>
              <ResourceDeck domain={activeTab?.type} id={activeTab?.key} />
            </Splitter.Panel>
          )}
        </Splitter>
      </div>
    </div>
  );
};
