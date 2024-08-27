import { IconDelete, IconMore, IconEdit } from '@arco-design/web-react/icon';
import { Dropdown, Menu, Button, Popconfirm, Message } from '@arco-design/web-react';
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
  transform: 'translateY(1px)',
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
    <Menu onClick={(e) => e.stopPropagation()}>
      <Menu.Item key="edit">
        <div onClick={(e) => handlUpdateInstance(e)}>
          <IconEdit style={iconStyle} />
          {t('common.edit')}
        </div>
      </Menu.Item>
      <Menu.Item key="delete">
        <Popconfirm
          focusLock
          title={t('common.deleteConfirmMessage')}
          position="br"
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          getPopupContainer={getPopupContainer}
          onOk={(e) => {
            handleDeleteInstance(e);
          }}
          onCancel={(e) => {
            handleCancel(e);
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <IconDelete style={iconStyle} />
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
}

export const InstanceDropdownMenu = (props: InstanceDropdownMenuProps) => {
  const { data, postDeleteList, setUpdateModal, getPopupContainer } = props;
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
      Message.error({ content: t('common.putError') });
    } else {
      Message.success({ content: t('common.putSuccess') });
    }

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

  const droplist = DropList({ handleCancel, handlUpdateInstance, handleDeleteInstance, getPopupContainer });

  return (
    <Dropdown
      position="br"
      popupVisible={popupVisible}
      droplist={droplist}
      triggerProps={{ onClickOutside: () => setPopupVisible(false) }}
      getPopupContainer={getPopupContainer}
    >
      <Button
        icon={<IconMore style={{ fontSize: 16 }} />}
        type="text"
        onClick={(e) => handleIconClick(e)}
        className="text-gray-500"
      ></Button>
    </Dropdown>
  );
};
