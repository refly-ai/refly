import { useState } from 'react';
import { Avatar, Button, Typography, Message as message, Tooltip } from '@arco-design/web-react';
import { InstanceDropdownMenu } from '@refly-packages/ai-workspace-common/components/skill/instance-dropdown-menu';
import { NewSkillInstanceModal } from '@refly-packages/ai-workspace-common/components/skill/new-instance-modal';

import { IconPlayCircle, IconToTop, IconToBottom } from '@arco-design/web-react/icon';

// 样式
import './index.scss';
import { SkillInstance } from '@refly/openapi-schema';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InstanceInvokeModal } from '@refly-packages/ai-workspace-common/components/skill/instance-invoke-modal';
import { useSkillStore } from '@refly-packages/ai-workspace-common/stores/skill';
import { useHandleTopSkills } from '@refly-packages/ai-workspace-common/stores/handle-top-skills';
import { SkillInstanceListSource } from '@refly-packages/ai-workspace-common/components/skill/skill-intance-list';

interface InstanceItemProps {
  data: SkillInstance;
  itemKey: number;
  canGoDetail?: boolean;
  isTopSkill?: boolean;
  source?: SkillInstanceListSource;
  refreshList?: () => void;
  postDeleteList?: (data: SkillInstance) => void;
}

export const InstanceItem = (props: InstanceItemProps) => {
  const navigate = useNavigate();
  const setSelectedSkillInstalce = useSkillStore((state) => state.setSelectedSkillInstalce);
  const setSkillManagerModalVisible = useSkillStore((state) => state.setSkillManagerModalVisible);

  const { data, itemKey, canGoDetail, isTopSkill, source, refreshList, postDeleteList } = props;
  const { t } = useTranslation();
  const handleTopSkills = useHandleTopSkills();

  const getInstanceItemPopupContainer = () => {
    const elem = document.getElementById(`instanceItem${itemKey}${isTopSkill ? '-top' : ''}`);

    return elem as HTMLElement;
  };

  const goSkillDetail = () => {
    const { skillId } = data;

    // click from skill-management-modal, set selectedSkill for copilot
    if (source === 'skill-management-modal') {
      setSelectedSkillInstalce(data);
      setSkillManagerModalVisible(false);

      return;
    }

    if (source === 'template' || !skillId || !canGoDetail) {
      return;
    }
    navigate(`/skill-detail?skillId=${skillId}`);
  };

  const handleTopSkill = (e) => {
    e.stopPropagation();
    const skill = data as SkillInstance;
    let topSkills = JSON.parse(localStorage.getItem('topSkills') || '[]');

    if (isTopSkill) {
      // 如果已经是置顶技能,则从列表中移除
      topSkills = topSkills.filter((topSkill) => topSkill.skillId !== skill.skillId);
      localStorage.setItem('topSkills', JSON.stringify(topSkills));
      message.success(t('skill.skillManagement.removedFromTop'));
    } else {
      if (topSkills.length >= 5) {
        message.info(t('skill.skillManagement.toppedLimit'));
        return;
      }
      const isAlreadyTopped = topSkills.some((topSkill: SkillInstance) => topSkill.skillId === skill.skillId);
      if (!isAlreadyTopped) {
        topSkills.push(skill);
        localStorage.setItem('topSkills', JSON.stringify(topSkills));
        message.success(t('skill.skillManagement.toppedSuccessfully'));
      } else {
        message.info(t('skill.skillManagement.alreadyTopped'));
      }
    }
    handleTopSkills.setShouldUpdate(true);
  };

  const [visible, setVisible] = useState(false);
  const [invokeModalVisible, setInvokeModalVisible] = useState(false);
  const handleClickInvoke = (e) => {
    e.stopPropagation();
    setInvokeModalVisible(true);
  };

  return (
    <div id={`instanceItem${itemKey}${isTopSkill ? '-top' : ''}`}>
      <div
        className={`instance-item ${source === 'skill-management-modal' ? 'instance-item-management' : ''}`}
        onClick={goSkillDetail}
      >
        <div className="instance-item__header">
          <div className="instance-item__profile">
            <Avatar size={40} shape="square" style={{ backgroundColor: '#00d0b6', borderRadius: 8 }}>
              {data?.displayName}
            </Avatar>
          </div>
          <div className="instance-item__title">
            <div className="instance-item__title-name">{data?.displayName}</div>
            {/* <div className="instance-item__title-info">
              <span className="instance-item__title-info-item">
                <IconUser /> 99
              </span>
              <Divider type="vertical" />
              <span className="instance-item__title-info-item">
                <IconPlayCircle /> 1k
              </span>
            </div> */}
          </div>
        </div>

        {source !== 'skill-management-modal' && (
          <div className="instance-item__desc">
            <Typography.Paragraph ellipsis={{ rows: 3 }} style={{ lineHeight: 1.51 }}>
              {data?.description}
            </Typography.Paragraph>
          </div>
        )}

        <div className="instance-item__action">
          <Button
            icon={<IconPlayCircle style={{ strokeWidth: 3 }} />}
            type="text"
            onClick={(e) => handleClickInvoke(e)}
            className="instance-item__action-icon"
          ></Button>

          {source === 'skill-management-modal' && (
            <Tooltip
              content={isTopSkill ? t('skill.skillManagement.removeFromTop') : t('skill.skillManagement.addToTop')}
            >
              <Button
                className="instance-item__action-icon"
                type="text"
                icon={isTopSkill ? <IconToBottom /> : <IconToTop />}
                onClick={(e) => handleTopSkill(e)}
              />
            </Tooltip>
          )}

          <InstanceDropdownMenu
            data={data as SkillInstance}
            setUpdateModal={(val) => setVisible(val)}
            postDeleteList={postDeleteList}
            getPopupContainer={!isTopSkill && getInstanceItemPopupContainer}
          />
        </div>
      </div>
      <NewSkillInstanceModal
        type="update"
        instance={data}
        visible={visible}
        setVisible={(val) => setVisible(val)}
        postConfirmCallback={refreshList}
      />
      <InstanceInvokeModal visible={invokeModalVisible} setVisible={(val) => setInvokeModalVisible(val)} data={data} />
    </div>
  );
};
