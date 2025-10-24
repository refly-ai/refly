import { WorkflowApp } from '@refly/openapi-schema';
import { HoverCardContainer } from '@refly-packages/ai-workspace-common/components/common/hover-card';
import { Avatar, Button, message, Popconfirm } from 'antd';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';
import { WiTime3 } from 'react-icons/wi';
import { useNavigate } from 'react-router-dom';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useState } from 'react';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';

export const AppCard = ({ data, onDelete }: { data: WorkflowApp; onDelete?: () => void }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUnpublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await getClient().deleteWorkflowApp({ body: { appId: data.appId } });
      if (response?.data?.success) {
        message.success(t('appManager.unpublishSuccess', { title: data.title }));
        onDelete?.();
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
    navigate(`/app/${data.shareId}`);
  };

  const handleViewButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleView();
  };

  const actionContent = (
    <>
      <Button type="primary" onClick={(e) => handleViewButtonClick(e)} className="flex-1">
        {t('appManager.view')}
      </Button>
      <Popconfirm
        title={
          <div className="max-w-[300px] max-h-[200px] overflow-y-auto text-sm">
            {t('appManager.deleteConfirm', { title: data.title })}
          </div>
        }
        onConfirm={(e) => handleUnpublish(e)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ loading: isDeleting }}
        onPopupClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Button
          type="default"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="flex-1"
        >
          {t('appManager.unpublish')}
        </Button>
      </Popconfirm>
    </>
  );

  return (
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
  );
};
