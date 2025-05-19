import { RiDeleteBinLine, RiMoreFill } from 'react-icons/ri';
import { TbEdit } from 'react-icons/tb';

import { Dropdown, Menu, Button, Popconfirm, message } from 'antd';
import { useState } from 'react';
import { useLocation, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useSkillStore } from '@refly-packages/ai-workspace-common/stores/skill';
// 类型
import { SkillInstance } from '@refly/openapi-schema';
// 请求
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { useTranslation } from 'react-i18next';

const iconStyle = {
  marginRight: 8,
  fontSize: 16,
  transform: 'translateY(3px)',
};

interface DropListProps {
  handleCancel: (e: any) => void;
  handlUpdateInstance: (e: any) => void;
  handleDeleteInstance?: (e: any) => void;
  getPopupContainer?: () => HTMLElement;
}

const DropList = (props: DropListProps) => {
  const { handleCancel, handlUpdateInstance, handleDeleteInstance, getPopupContainer } = props;
  const { t } = useTranslation();

  return (
    <Menu onClick={(e) => e.domEvent.stopPropagation()}>
      <Menu.Item key="edit">
        <div onClick={(e) => handlUpdateInstance(e)}>
          <TbEdit style={iconStyle} />
          {t('common.edit')}
        </div>
      </Menu.Item>
      <Menu.Item key="delete">
        <Popconfirm
          title={t('common.deleteConfirmMessage')}
          placement="bottomRight"
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          getPopupContainer={getPopupContainer}
          onConfirm={(e) => {
            handleDeleteInstance(e);
          }}
          onCancel={(e) => {
            handleCancel(e);
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <RiDeleteBinLine style={iconStyle} />
            {t('common.delete')}
          </div>
        </Popconfirm>
      </Menu.Item>
    </Menu>
  );
};

interface InstanceDropdownMenuProps {
  postDeleteList?: (data: SkillInstance) => void;
  setUpdateModal: (val: boolean) => void;
  getPopupContainer?: () => HTMLElement;
  data: SkillInstance;
  icon?: React.ReactNode;
}

export const InstanceDropdownMenu = (props: InstanceDropdownMenuProps) => {
  const { data, icon, postDeleteList, setUpdateModal, getPopupContainer } = props;
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const skillId = searchParams.get('skillId') as string;
  const skillStore = useSkillStore();

  const handlUpdateInstance = (e: MouseEvent) => {
    e.stopPropagation();
    setUpdateModal(true);
  };

  const handleDeleteInstance = async (e: MouseEvent) => {
    e.stopPropagation();
    const { error } = await getClient().deleteSkillInstance({ body: { skillId: data.skillId } });
    setPopupVisible(false);

    if (error) {
      console.error(error);
      return;
    }
    message.success(t('common.putSuccess'));

    if (postDeleteList) {
      postDeleteList(data);
    }
    if (location.pathname === '/skill-detail' && skillId === data.skillId) {
      window.history.back();
      if (skillStore.skillManagerModalVisible) {
        skillStore.setSkillManagerModalVisible(false);
      }
    }
  };

  const handleCancel = (e: MouseEvent) => {
    e.stopPropagation();
    setPopupVisible(false);
  };

  const handleIconClick = (e) => {
    e.stopPropagation();
    setPopupVisible(!popupVisible);
  };

  const droplist = DropList({
    handleCancel,
    handlUpdateInstance,
    handleDeleteInstance,
    getPopupContainer,
  });

  return (
    <Dropdown
      placement="bottomRight"
      open={popupVisible}
      dropdownRender={() => droplist}
      onOpenChange={(visible) => setPopupVisible(visible)}
      getPopupContainer={getPopupContainer}
    >
      <Button
        icon={icon || <RiMoreFill style={{ fontSize: 16 }} />}
        type="text"
        onClick={(e) => handleIconClick(e)}
        className="text-gray-500"
      />
    </Dropdown>
  );
};
