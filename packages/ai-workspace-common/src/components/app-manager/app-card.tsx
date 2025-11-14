import { WorkflowApp } from '@refly/openapi-schema';
import { HoverCardContainer } from '@refly-packages/ai-workspace-common/components/common/hover-card';
import { Avatar, Button, message, Modal } from 'antd';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';
import { WiTime3 } from 'react-icons/wi';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useState } from 'react';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';

export const AppCard = ({ data, onDelete }: { data: WorkflowApp; onDelete?: () => void }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const handleUnpublish = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await getClient().deleteWorkflowApp({ body: { appId: data.appId } });
      if (response?.data?.success) {
        message.success(t('appManager.unpublishSuccess', { title: data.title }));
        onDelete?.();
        setModalVisible(false);
      } else {
        message.error(t('appManager.unpublishFailed', { title: data.title }));
      }
    } catch {
      message.error(t('appManager.unpublishFailed', { title: data.title }));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleView = () => {
    window.open(`/app/${data.shareId}`, '_blank');
  };

  const handleViewButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleView();
  };

  const handleUnpublishClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setModalVisible(true);
  };

  const actionContent = (
    <>
      <Button type="primary" onClick={(e) => handleViewButtonClick(e)} className="flex-1">
        {t('appManager.view')}
      </Button>
      <Button type="default" onClick={(e) => handleUnpublishClick(e)} className="flex-1">
        {t('appManager.unpublish')}
      </Button>
    </>
  );

  return (
    <>
      <HoverCardContainer actionContent={actionContent} onClick={handleView}>
        <div className="flex flex-col justify-between border-[1px] border-solid border-refly-Card-Border rounded-xl bg-refly-bg-content-z2 hover:shadow-refly-m cursor-pointer overflow-hidden">
          <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative">
            {data?.coverUrl && (
              <img src={data?.coverUrl} alt={data.title} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="p-4 flex-1 flex flex-col gap-2">
            <div className="text-sm font-semibold truncate">{data.title}</div>
            <div className="h-5 text-xs text-refly-text-2 line-clamp-1">{data.description}</div>

            <div className="flex items-center gap-2 text-xs text-refly-text-2">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Avatar size={18} src={data.owner?.avatar || defaultAvatar} />
                <span className="truncate">
                  {data.owner?.nickname ? data.owner?.nickname : `@${data.owner?.name}`}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <WiTime3 className="w-4 h-4 text-refly-text-2" />
                <span className="whitespace-nowrap">
                  {time(data.createdAt, language as LOCALE)
                    ?.utc()
                    ?.fromNow()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </HoverCardContainer>
      <Modal
        title={t('common.deleteConfirmMessage')}
        centered
        width={416}
        open={modalVisible}
        onOk={handleUnpublish}
        onCancel={() => setModalVisible(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ loading: isDeleting }}
        destroyOnHidden
        closeIcon={null}
        confirmLoading={isDeleting}
      >
        <div>
          <div className="mb-2">{t('appManager.deleteConfirm', { title: data.title })}</div>
        </div>
      </Modal>
    </>
  );
};
