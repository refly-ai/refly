import { useSkillStore } from '@refly-packages/ai-workspace-common/stores/skill';
import { Modal } from 'antd';

// 组件
import { SkillInstanceList } from '@refly-packages/ai-workspace-common/components/skill/skill-intance-list';

// 样式
import './index.scss';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { useTranslation } from 'react-i18next';

export const SkillManagementModal = (_props: any) => {
  const { t } = useTranslation();
  const skillStore = useSkillStore();

  const onCancel = () => {
    skillStore.setSkillManagerModalVisible(false);
  };

  return (
    <Modal
      open={skillStore.skillManagerModalVisible}
      title={t('copilot.skillDisplay.skillManager')}
      getContainer={() => {
        const elem = getPopupContainer();

        return elem;
      }}
      style={{ width: '80vw', height: '80vh' }}
      className="skill-management-modal-wrap"
      footer={null}
      onCancel={onCancel}
      keyboard={true}
    >
      <div className="skill-management-modal-content">
        <SkillInstanceList source="skill-management-modal" />
      </div>
    </Modal>
  );
};
