import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ResourceList } from '@refly-packages/ai-workspace-common/components/workspace/resource-list';
import { DocumentList } from '@refly-packages/ai-workspace-common/components/workspace/document-list';
import { SiderCollapse } from '@refly-packages/ai-workspace-common/components/canvas/top-toolbar/sider-collapse';
import './index.scss';
import { IconDocument } from '@refly-packages/ai-workspace-common/components/common/icon';
import { IconResource } from '@refly-packages/ai-workspace-common/components/common/icon';
import {
  useKnowledgeBaseStoreShallow,
  type LibraryModalActiveKey,
} from '@refly-packages/ai-workspace-common/stores/knowledge-base';

export const ContentPanel = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = [
    {
      key: 'document',
      label: t('common.document'),
      icon: <IconDocument style={{ transform: 'translateY(2px)' }} />,
      children: <DocumentList />,
    },
    {
      key: 'resource',
      label: t('common.resource'),
      icon: <IconResource style={{ transform: 'translateY(2px)' }} />,
      children: <ResourceList />,
    },
  ];

  const { libraryModalActiveKey, updateLibraryModalActiveKey } = useKnowledgeBaseStoreShallow(
    (state) => ({
      libraryModalActiveKey: state.libraryModalActiveKey,
      updateLibraryModalActiveKey: state.updateLibraryModalActiveKey,
    }),
  );

  // Get tab from URL or use default
  const tabFromUrl = searchParams?.get('tab');
  const isValidTab = tabFromUrl === 'document' || tabFromUrl === 'resource';
  const activeKey = isValidTab ? tabFromUrl : libraryModalActiveKey;

  const handleTabChange = (key: string) => {
    const newKey = key as LibraryModalActiveKey;
    updateLibraryModalActiveKey(newKey);
    setSearchParams({ tab: newKey });
  };

  return (
    <div className="pb-4 px-8 h-full box-border overflow-hidden">
      <div className="flex gap-2">
        <SiderCollapse showDivider={false} size={18} />
        <div className="flex-1 pt-3">
          <Tabs type="card" activeKey={activeKey} items={tabs} onChange={handleTabChange} />
        </div>
      </div>
    </div>
  );
};
