import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { Dropdown, Button, Popconfirm, message, Empty, Divider } from 'antd';
import type { MenuProps, DropdownProps } from 'antd';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';

import {
  IconMoreHorizontal,
  IconDelete,
  IconDocumentFilled,
} from '@refly-packages/ai-workspace-common/components/common/icon';

import { useEffect, useState } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { Document } from '@refly/openapi-schema';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';

import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { ScrollLoading } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { useDeleteDocumentForLibrary } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-document-for-library';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';

const ActionDropdown = ({ doc, afterDelete }: { doc: Document; afterDelete: () => void }) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const { deleteDocumentForLibrary } = useDeleteDocumentForLibrary();

  const handleDelete = async () => {
    const success = await deleteDocumentForLibrary(doc.docId);
    if (success) {
      message.success(t('common.putSuccess'));
      setPopupVisible(false);
      afterDelete?.();
    }
  };

  const items: MenuProps['items'] = [
    {
      label: (
        <div onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            placement="bottomLeft"
            title={t('canvas.nodeActions.documentDeleteConfirm', {
              title: doc.title || t('common.untitled'),
            })}
            onConfirm={handleDelete}
            onCancel={() => setPopupVisible(false)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            overlayStyle={{ maxWidth: '300px' }}
          >
            <div className="flex items-center text-red-600">
              <IconDelete size={16} className="mr-2" />
              {t('workspace.deleteDropdownMenu.delete')}
            </div>
          </Popconfirm>
        </div>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setPopupVisible(open);
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      open={popupVisible}
      onOpenChange={handleOpenChange}
      menu={{ items }}
    >
      <Button type="text" icon={<IconMoreHorizontal />} onClick={(e) => e.stopPropagation()} />
    </Dropdown>
  );
};

const DocumentCard = ({ item, onDelete }: { item: Document; onDelete: () => void }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/document/${item.docId}`);
  };

  return (
    <div
      className="bg-white rounded-lg overflow-hidden border border-solid cursor-pointer border-gray-200 hover:border-green-500 transition-colors duration-200"
      onClick={handleClick}
    >
      <div className="h-36 px-4 py-3 overflow-hidden">
        <Markdown
          content={item.contentPreview || t('canvas.nodePreview.document.noContentPreview')}
          className="text-xs opacity-80"
        />
      </div>
      <Divider className="m-0 text-gray-200" />
      <div className="px-3 pt-2 pb-1 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3 mb-2">
          <IconDocumentFilled color={NODE_COLORS.document} size={24} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium max-w-48 truncate">
              {item.title || t('common.untitled')}
            </h3>
            <p className="text-xs text-gray-500">
              {time(item.updatedAt, language as LOCALE)
                .utc()
                .fromNow()}
            </p>
          </div>
        </div>
        <ActionDropdown doc={item} afterDelete={onDelete} />
      </div>
    </div>
  );
};

export const DocumentList = () => {
  const { t } = useTranslation();

  const { dataList, setDataList, loadMore, reload, hasMore, isRequesting } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listDocuments({
        query: queryPayload,
      });
      return res?.data;
    },
    pageSize: 16,
  });

  useEffect(() => {
    reload();
  }, []);

  return (
    <Spin className="w-full h-full" spinning={isRequesting}>
      <div className="w-full h-[calc(100vh-80px)] overflow-y-auto">
        {isRequesting || dataList.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
              {dataList.map((item) => (
                <DocumentCard
                  key={item.docId}
                  item={item}
                  onDelete={() => setDataList(dataList.filter((n) => n.docId !== item.docId))}
                />
              ))}
            </div>
            <ScrollLoading isRequesting={isRequesting} hasMore={hasMore} loadMore={loadMore} />
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <Empty description={t('common.empty')} />
          </div>
        )}
      </div>
    </Spin>
  );
};
