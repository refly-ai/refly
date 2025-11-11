import React, { ReactNode } from 'react';
import { Layout, Button, Tooltip } from 'antd';
import { UnorderedListOutlined, LeftOutlined } from '@ant-design/icons';
import { SidebarMinimap } from './SidebarMinimap';
import { type NodeRelation } from './ArtifactRenderer';
import { useTranslation } from 'react-i18next';

interface PageLayoutProps {
  children: ReactNode;
  showMinimap: boolean;
  nodes: NodeRelation[];
  activeNodeIndex: number;
  headerContent?: ReactNode;
  readonly?: boolean;
  onNodeSelect: (index: number) => void;
  onReorderNodes?: (newOrder: NodeRelation[]) => void;
  toggleMinimap: () => void;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  showMinimap,
  nodes,
  activeNodeIndex,
  headerContent,
  readonly = false,
  onNodeSelect,
  onReorderNodes,
  toggleMinimap,
}) => {
  const { t } = useTranslation();

  return (
    <Layout className="overflow-hidden bg-[#f7f9fc] h-[var(--screen-height)]">
      {/* Top navigation bar */}
      {headerContent && (
        <div className="flex justify-between items-center px-4 py-2.5 bg-white border-b border-gray-200 z-20 shadow-sm dark:bg-gray-900 dark:border-gray-700">
          {headerContent}
        </div>
      )}

      {/* Main content area */}
      <Layout className="flex-1 overflow-hidden">
        {/* Left thumbnail panel */}
        {showMinimap && (
          <Layout.Sider
            width={180}
            theme="light"
            className="bg-[#f7f9fc] border-r border-gray-200 overflow-hidden relative dark:bg-gray-700/80 dark:border-gray-700"
          >
            <SidebarMinimap
              nodes={nodes}
              activeNodeIndex={activeNodeIndex}
              onNodeSelect={onNodeSelect}
              onReorderNodes={onReorderNodes || (() => {})}
              readonly={!!readonly} // Fix readonly property
            />
            {/* Button to hide minimap */}
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={toggleMinimap}
              className="absolute top-2 right-2 z-10 bg-white shadow-sm hover:bg-gray-100 border border-gray-200 rounded-full h-6 w-6 flex items-center justify-center p-0 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-950"
              size="small"
            />
          </Layout.Sider>
        )}

        {/* Middle content area */}
        <Layout.Content className="relative overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800/90 ">
          {/* Button to show minimap */}
          {!showMinimap && (
            <div className="fixed left-0 top-60 z-500">
              <Tooltip title={t('pages.components.navigationDirectory')} placement="right">
                <Button
                  type="default"
                  icon={<UnorderedListOutlined />}
                  onClick={toggleMinimap}
                  className="bg-white shadow-refly-m rounded-r-md border-l-0 h-8 hover:bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-950"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                />
              </Tooltip>
            </div>
          )}

          <div className="mx-auto py-4 px-8 mb-16" style={{ maxWidth: '900px' }}>
            {children}
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default PageLayout;
