import { useTranslation } from 'react-i18next';

import { DocumentList } from '../document-list';
import { ResourceList } from '../resource-list';

import { Modal, Tabs } from 'antd';
import './index.scss';
import {
  IconDocument,
  IconLibrary,
  IconResource,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';

interface LibraryModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const LibraryModal = (props: LibraryModalProps) => {
  const { visible, setVisible } = props;
  const { t } = useTranslation();
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

  const activeKey = useKnowledgeBaseStoreShallow((state) => state.libraryModalActiveKey);

  return (
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
      <Tabs defaultActiveKey={activeKey} items={tabs} />
    </Modal>
  );
};
