import { ToolsetInstance } from '@refly/openapi-schema';
import { Delete, Edit, More } from 'refly-icons';
import { Button, Skeleton, Tag, Switch, MenuProps, Modal, Dropdown, message, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useState } from 'react';
import { ToolInstallModal } from './tool-install-modal';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Favicon } from '@refly-packages/ai-workspace-common/components/common/favicon';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';

const ActionDropdown = ({
  tool,
  handleEdit,
  handleDelete,
}: {
  tool: ToolsetInstance;
  handleEdit: () => void;
  handleDelete: () => void;
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const onEdit = () => {
    setVisible(false);
    handleEdit();
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await handleDelete();
      setModalVisible(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const items: MenuProps['items'] = [
    {
      label: (
        <div className="flex items-center flex-grow">
          <Edit size={16} className="mr-2" />
          {t('common.edit')}
        </div>
      ),
      key: 'edit',
      onClick: onEdit,
    },
    {
      label: (
        <div
          className="flex items-center text-red-600 flex-grow cursor-pointer"
          onClick={() => {
            setVisible(false);
            setModalVisible(true);
          }}
        >
          <Delete size={16} className="mr-2" />
          {t('common.delete')}
        </div>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setVisible(open);
    }
  };

  return (
    <>
      <Dropdown trigger={['click']} open={visible} onOpenChange={handleOpenChange} menu={{ items }}>
        <Button type="text" icon={<More size={18} />} size="small" />
      </Dropdown>
      <Modal
        title={t('common.deleteConfirmMessage')}
        centered
        width={416}
        open={modalVisible}
        onOk={handleDeleteConfirm}
        onCancel={() => setModalVisible(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ loading: isDeleting }}
        destroyOnHidden
        closeIcon={null}
        confirmLoading={isDeleting}
      >
        <div>
          <div className="mb-2">
            {t('settings.modelConfig.deleteConfirm', {
              name: tool.name || t('common.untitled'),
            })}
          </div>
        </div>
      </Modal>
    </>
  );
};

const ToolItem = ({
  tool,
  refetchToolsets,
}: { tool: ToolsetInstance; refetchToolsets: () => void }) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language as 'en' | 'zh';
  const desc = (tool?.definition?.descriptionDict?.[currentLanguage] ||
    tool?.definition?.descriptionDict?.en ||
    '') as string;

  const labelName = (tool?.definition?.labelDict?.[currentLanguage] ||
    tool?.definition?.labelDict?.en) as string;

  const isBuiltin = tool.toolsetId === 'builtin';
  const [visible, setVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const updateToolEnabled = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      const { data } = await getClient().updateToolset({
        body: {
          toolsetId: tool.toolsetId,
          enabled,
        },
      });
      if (data.success) {
        message.success(
          t(`settings.toolStore.install.${enabled ? 'toolEnabled' : 'toolDisabled'}`, {
            name: tool.name,
          }),
        );
        refetchToolsets();
      } else {
        message.error(t('common.putErr'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEdit = () => {
    setVisible(true);
  };

  const handleDelete = async () => {
    const { data } = await getClient().deleteToolset({
      body: {
        toolsetId: tool.toolsetId,
      },
    });
    if (data.success) {
      message.success(t('common.deleteSuccess'));
      refetchToolsets();
    } else {
      message.error(t('common.deleteErr'));
    }
  };

  return (
    <div
      className="mb-2 px-2 py-3 rounded-[8px] cursor-pointer hover:bg-refly-tertiary-hover flex items-start gap-3"
      key={tool.toolsetId}
    >
      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-refly-tertiary-default flex items-center justify-center">
        {isBuiltin ? (
          <Logo logoProps={{ show: true, className: '!w-6 !h-6' }} textProps={{ show: false }} />
        ) : (
          <Favicon url={tool.definition?.domain} size={24} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-refly-text-0 leading-5 text-sm">
              {tool.toolsetId === 'builtin' ? labelName : tool.name}
            </div>
            {desc && (
              <div className="mt-0.5 text-refly-text-1 text-xs leading-4 line-clamp-2">{desc}</div>
            )}
          </div>

          {!tool.isGlobal && !isBuiltin && (
            <div className="flex items-center gap-2">
              <Switch
                size="small"
                checked={tool.enabled}
                loading={isUpdating}
                onChange={(checked) => updateToolEnabled(checked)}
              />
              <ActionDropdown tool={tool} handleEdit={handleEdit} handleDelete={handleDelete} />
            </div>
          )}
        </div>

        {(tool?.definition?.tools?.length ?? 0) > 0 && (
          <div className="mt-2 p-2 bg-refly-bg-control-z0 rounded-[8px]">
            <div className="flex items-center flex-wrap gap-1">
              {tool?.definition?.tools?.map((t, index) => {
                const toolDesc = (t?.descriptionDict?.[currentLanguage] ||
                  t?.descriptionDict?.en ||
                  '') as string;
                return (
                  <Tooltip key={index} title={toolDesc} placement="top">
                    <Tag className="bg-refly-tertiary-default border-solid border-[1px] border-refly-Card-Border font-semibold text-refly-text-1 h-[18px] flex items-center justify-center rounded-[4px] text-[10px] leading-[14px] cursor-pointer">
                      {t.name}
                    </Tag>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ToolInstallModal
        mode="update"
        toolInstance={tool}
        visible={visible}
        onCancel={() => setVisible(false)}
      />
    </div>
  );
};

export const ToolList = ({
  toolInstances,
  refetchToolsets,
  isLoadingToolsets,
}: {
  toolInstances: ToolsetInstance[];
  refetchToolsets: () => void;
  isLoadingToolsets: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-5 h-full overflow-y-auto">
      {isLoadingToolsets && toolInstances.length === 0 ? (
        <Skeleton paragraph={{ rows: 10 }} active title={false} />
      ) : (
        <Spin spinning={isLoadingToolsets}>
          {toolInstances.map((tool) => (
            <ToolItem key={tool.toolsetId} tool={tool} refetchToolsets={refetchToolsets} />
          ))}
          <div className="text-center text-gray-400 text-sm mt-4 pb-10">{t('common.noMore')}</div>
        </Spin>
      )}
    </div>
  );
};
