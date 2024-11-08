import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { Drawer } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
// 样式
import './index.scss';

// 自定义组件
import { ResourceList } from '@refly-packages/ai-workspace-common/components/resource-list';
import { Resource } from '@refly/openapi-schema';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';

interface SourceListModalProps {
  title: string;
  classNames: string;
  width?: number;
  height?: string;
  placement?: 'bottom' | 'left' | 'right' | 'top';
  resources: Partial<Resource>[];
}

export const SourceListModal = (props: SourceListModalProps) => {
  const { t } = useTranslation();
  const knowledgeBaseStore = useKnowledgeBaseStore();

  return (
    <Drawer
      width={props.width || '100%'}
      style={{
        zIndex: 66,
        background: '#FCFCF9',
        height: props.height || '66%',
      }}
      getPopupContainer={() => {
        const container = getPopupContainer();
        return container.querySelector('.ai-copilot-container') as Element;
      }}
      headerStyle={{ justifyContent: 'center' }}
      title={
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontWeight: 'bold' }}>{props.title || ''}</span>
        </div>
      }
      visible={knowledgeBaseStore.sourceListModalVisible}
      placement={props.placement || 'bottom'}
      footer={null}
      onOk={() => {
        knowledgeBaseStore.updateSourceListModalVisible(false);
      }}
      onCancel={() => {
        knowledgeBaseStore.updateSourceListModalVisible(false);
      }}
    >
      <ResourceList
        placeholder={t('copilot.sourceListModal.searchPlaceholder')}
        resources={props.resources}
        showUtil={false}
        searchKey="description"
        btnProps={{ defaultActiveKeys: [] }}
        showBtn={{ summary: false, markdown: true, externalOrigin: true }}
        classNames={props.classNames}
        handleItemClick={(item) => {
          //   jumpNewKnowledgeBase(kbId)
          //   knowledgeBaseStore.updateKbModalVisible(false)
        }}
      />
    </Drawer>
  );
};
