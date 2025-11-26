import { useNavigate } from 'react-router-dom';
import { message, Button, Table, Popconfirm, Space, Empty } from 'antd';
import { PlusOutlined, EditOutlined, ShareAltOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useListPages,
  useSharePage,
  useDeletePage,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { Page } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { formatDate } from '@refly-packages/ai-workspace-common/utils/date';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

function PagesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Use useListPages query hook to get page list
  const {
    data: pagesData,
    isLoading: loading,
    refetch: refetchPages,
    error,
  } = useListPages({}, undefined);

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('Failed to fetch page list');
      message.error(t('pages.list.fetchFailed'));
    }
  }, [error, t]);

  // Use useSharePage and useDeletePage mutation hooks to handle page operations
  const { mutate: sharePage, isPending: isSharing } = useSharePage(undefined, {
    onSuccess: (data) => {
      if (data?.data?.data?.shareUrl) {
        message.success(t('pages.list.shareSuccess'));
        navigator.clipboard.writeText(data.data.data.shareUrl);
      }
    },
    onError: () => {
      console.error('Failed to share page');
      message.error(t('pages.list.shareFailed'));
    },
  });

  const { mutate: deletePage, isPending: isDeleting } = useDeletePage(undefined, {
    onSuccess: () => {
      message.success(t('pages.list.deleteSuccess'));
      refetchPages();
    },
    onError: () => {
      console.error('Failed to delete page');
      message.error(t('pages.list.deleteFailed'));
    },
  });

  const handleEditPage = (pageId: string) => {
    navigate(`/pages/${pageId}`);
  };

  const handleSharePage = (pageId: string) => {
    sharePage({ path: { pageId } });
  };

  const handleDeletePage = (pageId: string) => {
    deletePage({ path: { pageId } });
  };

  // Extract page data
  const pages = pagesData?.data?.pages || [];

  const columns = [
    {
      title: t('pages.list.title'),
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: t('pages.list.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, string> = {
          draft: t('pages.list.statusDraft'),
          published: t('pages.list.statusPublished'),
        };
        return statusMap[status] || status;
      },
    },
    {
      title: t('pages.list.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: t('pages.list.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: t('pages.list.actions'),
      key: 'action',
      render: (_: any, record: Page) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditPage(record.pageId)}>
            {t('pages.list.edit')}
          </Button>
          <Button
            type="link"
            icon={<ShareAltOutlined />}
            onClick={() => handleSharePage(record.pageId)}
            loading={isSharing}
          >
            {t('pages.list.share')}
          </Button>
          <Popconfirm
            title={t('pages.list.confirmDelete')}
            onConfirm={() => handleDeletePage(record.pageId)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" danger icon={<DeleteOutlined />} loading={isDeleting}>
              {t('pages.list.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('pages.list.myPages')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/workspace')}>
          {t('pages.list.createPage')}
        </Button>
      </div>

      {pages.length === 0 && !loading ? (
        <Empty description={t('pages.list.noPages')} className="py-10" />
      ) : (
        <Table
          columns={columns}
          dataSource={pages.map((page) => ({ ...page, key: page.pageId }))}
          loading={loading}
          pagination={{
            pageSize: 10,
            total: pagesData?.data?.total,
            onChange: (_page, _pageSize) => {
              // Refresh query when changing page
              refetchPages();
            },
          }}
          className="mt-4"
        />
      )}
    </div>
  );
}

export default PagesPage;
