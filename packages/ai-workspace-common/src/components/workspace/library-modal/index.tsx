import { useTranslation } from 'react-i18next';

import { DocumentList } from '../document-list';
import { ResourceList } from '../resource-list';
import { ProjectList } from '../project-list';

import { Modal, Tabs } from 'antd';
import './index.scss';
import {
  IconDocument,
  IconLibrary,
  IconProject,
  IconResource,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useState, useMemo } from 'react';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';

interface LibraryModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const LibraryModal = (props: LibraryModalProps) => {
  const { visible, setVisible } = props;
  const { t } = useTranslation();
  const { projectId } = useGetProjectCanvasId();

  const activeKey = useKnowledgeBaseStoreShallow((state) => state.libraryModalActiveKey);
  const updateLibraryModalActiveKey = useKnowledgeBaseStoreShallow(
    (state) => state.updateLibraryModalActiveKey,
  );

  const [refreshProjectList, setRefreshProjectList] = useState(false);

  const tabs = useMemo(
    () => [
      {
        key: 'project',
        label: (
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center">
              <IconProject />
              <span className="ml-1">{t('common.project')}</span>
            </span>
          </div>
        ),
        children: (
          <ProjectList
            showLibraryModal={visible}
            setShowLibraryModal={setVisible}
            refresh={refreshProjectList}
            setRefresh={setRefreshProjectList}
          />
        ),
      },
      !projectId && {
        key: 'document',
        label: (
          <span className="flex items-center">
            <IconDocument />
            <span className="ml-1">{t('common.document')}</span>
          </span>
        ),
        children: <DocumentList />,
      },
      !projectId && {
        key: 'resource',
        label: (
          <span className="flex items-center">
            <IconResource />
            <span className="ml-1">{t('common.resource')}</span>
          </span>
        ),
        children: <ResourceList />,
      },
    ],
    [activeKey, t, refreshProjectList, projectId, visible, setVisible],
  );

  return (
    <>
      <Modal
        className="library-modal"
        centered
        title={
          <span className="flex items-center gap-2 text-lg font-medium">
            <IconLibrary /> {t('common.library')}
          </span>
        }
        width={1200}
        footer={null}
        open={visible}
        onCancel={() => setVisible(false)}
        focusTriggerAfterClose={false}
      >
        <Tabs
          defaultActiveKey={activeKey}
          items={tabs}
          onChange={(key) => updateLibraryModalActiveKey(key)}
        />
      </Modal>
    </>
  );
};
