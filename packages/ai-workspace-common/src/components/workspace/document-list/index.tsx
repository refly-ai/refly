import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { Dropdown, Button, Popconfirm, message, Empty, Divider, Typography } from 'antd';
import InfiniteScroll from 'react-infinite-scroll-component';
import {
  Spinner,
  EndMessage,
} from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import type { MenuProps, DropdownProps } from 'antd';

import {
  IconMoreHorizontal,
  IconDelete,
  IconDownloadFile,
  IconDocumentFilled,
  IconCreateDocument,
} from '@refly-packages/ai-workspace-common/components/common/icon';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { Document } from '@refly/openapi-schema';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';

import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useDeleteDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-document';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { LuPlus } from 'react-icons/lu';
import { useMatch } from 'react-router-dom';
import { useExportDocumentToMarkdown } from '@refly-packages/ai-workspace-common/hooks/use-export-document-to-markdown';
import { useExportDocumentToPdf } from '@refly-packages/ai-workspace-common/hooks/use-export-document-to-pdf';
import { useExportDocumentToDocx } from '@refly-packages/ai-workspace-common/hooks/use-export-document-to-docx';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useCreateDocumentPurely } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document-purely';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
const ActionDropdown = ({ doc, afterDelete }: { doc: Document; afterDelete: () => void }) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { deleteDocument } = useDeleteDocument();
  const { exportDocumentToMarkdown } = useExportDocumentToMarkdown();
  const { exportDocumentToDocx } = useExportDocumentToDocx();
  const { exportDocumentToPdf } = useExportDocumentToPdf();
  const { setShowLibraryModal } = useSiderStoreShallow((state) => ({
    setShowLibraryModal: state.setShowLibraryModal,
  }));
  const isShareCanvas = useMatch('/share/canvas/:canvasId');
  const { isCanvasOpen } = useGetProjectCanvasId();

  const handleDelete = async () => {
    const success = await deleteDocument(doc.docId);
    if (success) {
      message.success(t('common.putSuccess'));
      setPopupVisible(false);
      afterDelete?.();
    }
  };

  const handleExportDocumentToMarkdown = useDebouncedCallback(async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);
      const content = await exportDocumentToMarkdown(doc.docId);

      // 创建Blob对象
      const blob = new Blob([content], { type: 'text/markdown' });
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title || t('common.untitled')}.md`;
      document.body.appendChild(a);
      a.click();

      // 清理
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success(t('common.exportSuccess'));
    } catch (error) {
      console.error('Export error:', error);
      message.error(t('common.exportFailed'));
    } finally {
      setIsExporting(false);
      setPopupVisible(false);
    }
  }, 300);

  const handleExportDocumentToDocx = useDebouncedCallback(async () => {
    if (isExporting) return;
    const data = await exportDocumentToDocx(doc.docId);

    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title || t('common.untitled')}.docx`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    message.success(t('common.exportSuccess'));
    try {
      setIsExporting(true);
    } catch (error) {
      console.error('Export error:', error);
      message.error(t('common.exportFailed'));
    } finally {
      setIsExporting(false);
      setPopupVisible(false);
    }
  }, 300);

  const handleExportDocumentToPdf = useDebouncedCallback(async () => {
    if (isExporting) return;
    const content = await exportDocumentToPdf(doc.docId);

    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title || t('common.untitled')}.pdf`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    message.success(t('common.exportSuccess'));
    try {
      setIsExporting(true);
    } catch (error) {
      console.error('Export error:', error);
      message.error(t('common.exportFailed'));
    } finally {
      setIsExporting(false);
      setPopupVisible(false);
    }
  });

  const handleAddToCanvas = () => {
    nodeOperationsEmitter.emit('addNode', {
      node: {
        type: 'document',
        data: {
          title: doc.title,
          entityId: doc.docId,
          contentPreview: doc.contentPreview,
        },
      },
      shouldPreview: true,
      needSetCenter: true,
    });
    setShowLibraryModal(false);
  };

  const items: MenuProps['items'] = [
    !isShareCanvas && {
      label: (
        <div className="flex items-center flex-grow">
          <LuPlus size={16} className="mr-2" />
          {t('workspace.addToCanvas')}
        </div>
      ),
      key: 'addToCanvas',
      onClick: () => {
        if (isCanvasOpen) {
          handleAddToCanvas();
        } else {
          message.error(t('workspace.noCanvasSelected'));
        }
      },
    },
    {
      label: (
        <div className="flex items-center flex-grow">
          <IconDownloadFile size={16} className="mr-2" />
          {t('workspace.exportDocumentToMarkdown')}
        </div>
      ),
      key: 'exportDocumentToMarkdown',
      onClick: () => handleExportDocumentToMarkdown(),
    },
    {
      label: (
        <div className="flex items-center flex-grow">
          <IconDownloadFile size={16} className="mr-2" />
          {t('workspace.exportDocumentToDocx')}
        </div>
      ),
      key: 'exportDocumentToDocx',
      onClick: () => handleExportDocumentToDocx(),
    },
    {
      label: (
        <div className="flex items-center flex-grow">
          <IconDownloadFile size={16} className="mr-2" />
          {t('workspace.exportDocumentToPdf')}
        </div>
      ),
      key: 'exportDocumentToPdf',
      onClick: () => handleExportDocumentToPdf(),
    },
    {
      label: (
        <div className="flex items-center flex-grow">
          <IconDownloadFile size={16} className="mr-2" />
          {t('workspace.exportDocumentToMarkdown')}
        </div>
      ),
      key: 'exportDocumentToMarkdown',
      onClick: () => handleExportDocumentToMarkdown(),
    },
    {
      label: (
        <div className="flex items-center flex-grow">
          <IconDownloadFile size={16} className="mr-2" />
          {t('workspace.exportDocumentToDocx')}
        </div>
      ),
      key: 'exportDocumentToDocx',
      onClick: () => handleExportDocumentToDocx(),
    },
    {
      label: (
        <div className="flex items-center flex-grow">
          <IconDownloadFile size={16} className="mr-2" />
          {t('workspace.exportDocumentToPdf')}
        </div>
      ),
      key: 'exportDocumentToPdf',
      onClick: () => handleExportDocumentToPdf(),
    },
    {
      label: (
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
          <div className="flex items-center text-red-600 flex-grow">
            <IconDelete size={16} className="mr-2" />
            {t('workspace.deleteDropdownMenu.delete')}
          </div>
        </Popconfirm>
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
      <Button type="text" icon={<IconMoreHorizontal />} />
    </Dropdown>
  );
};

const DocumentCard = ({ item, onDelete }: { item: Document; onDelete: () => void }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-solid cursor-pointer border-gray-200 hover:border-green-500 transition-colors duration-200">
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
            <Typography.Text className="text-sm font-medium w-48" ellipsis={{ tooltip: true }}>
              {item.title || t('common.untitled')}
            </Typography.Text>
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

const DocumentList = () => {
  const { t } = useTranslation();
  const { createDocument, isCreating } = useCreateDocumentPurely();
  const { showLibraryModal } = useSiderStoreShallow((state) => ({
    showLibraryModal: state.showLibraryModal,
  }));

  const { dataList, setDataList, loadMore, reload, hasMore, isRequesting } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listDocuments({
        query: queryPayload,
      });
      return res?.data;
    },
    pageSize: 12,
  });

  const documentCards = useMemo(() => {
    return dataList?.map((item) => (
      <DocumentCard
        key={item.docId}
        item={item}
        onDelete={() => setDataList(dataList.filter((n) => n.docId !== item.docId))}
      />
    ));
  }, [dataList, setDataList]);

  const handleLoadMore = useCallback(() => {
    if (!isRequesting && hasMore) {
      loadMore();
    }
  }, [isRequesting, hasMore, loadMore]);

  useEffect(() => {
    if (showLibraryModal) {
      reload();
    } else {
      setDataList([]);
    }
  }, [showLibraryModal]);

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty description={t('common.empty')}>
        <Button
          loading={isCreating}
          className="text-[#00968F]"
          icon={<IconCreateDocument className="-mr-1 flex items-center justify-center" />}
          onClick={() => {
            createDocument(t('common.untitled'), '');
          }}
        >
          {t('canvas.toolbar.createDocument')}
        </Button>
      </Empty>
    </div>
  );

  return (
    <Spin className="w-full h-full" spinning={isRequesting && dataList.length === 0}>
      <div id="documentScrollableDiv" className="w-full h-[calc(60vh-60px)] overflow-y-auto">
        {dataList.length > 0 ? (
          <InfiniteScroll
            dataLength={dataList.length}
            next={handleLoadMore}
            hasMore={hasMore}
            loader={isRequesting ? <Spinner /> : null}
            endMessage={<EndMessage />}
            scrollableTarget="documentScrollableDiv"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {documentCards}
            </div>
          </InfiniteScroll>
        ) : (
          !isRequesting && emptyState
        )}
      </div>
    </Spin>
  );
};

export { DocumentList };
