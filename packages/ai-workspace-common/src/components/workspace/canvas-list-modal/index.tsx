import { useEffect, useCallback, useMemo, memo } from 'react';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { Canvas } from '@refly/openapi-schema';
import { IconCanvas } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Modal, Empty, Divider, Typography } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import InfiniteScroll from 'react-infinite-scroll-component';
import {
  Spinner,
  EndMessage,
} from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { LOCALE } from '@refly/common-types';
import './index.scss';
import { CanvasActionDropdown } from './canvasActionDropdown';

interface CanvasListProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const CanvasItem = (props: {
  canvas: Canvas;
  handleClickCanvas: (canvas: Canvas) => void;
  afterDelete: (canvas: Canvas) => void;
  afterRename: (newTitle: string, canvasId: string) => void;
}) => {
  const { canvas, handleClickCanvas, afterDelete, afterRename } = props;
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];

  return (
    <div
      className="bg-white rounded-lg overflow-hidden border border-solid cursor-pointer border-gray-200 hover:border-green-500 transition-colors duration-200"
      onClick={() => handleClickCanvas(canvas)}
    >
      <div className="h-36 overflow-hidden">
        {canvas?.minimapUrl ? (
          <img
            src={`${canvas?.minimapUrl}${canvas?.minimapUrl.includes('?') ? '&' : '?'}_t=${canvas?.updatedAt ?? Date.now()}`}
            alt="minimap"
            className="w-full h-full p-3 object-cover"
            key={`minimap-${canvas?.canvasId}-${canvas?.updatedAt ?? Date.now()}`}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-gray-100" />
        )}
      </div>
      <Divider className="m-0 text-gray-200" />
      <div className="px-3 pt-2 pb-1 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3 mb-2">
          <IconCanvas size={24} className="text-gray-500" />
          <div className="flex-1 min-w-0">
            <Typography.Text className="text-sm font-medium w-48" ellipsis={{ tooltip: true }}>
              {canvas?.title || t('common.untitled')}
            </Typography.Text>

            <p className="text-xs text-gray-500">
              {time(canvas?.updatedAt, language as LOCALE)
                .utc()
                .fromNow()}
            </p>
          </div>
        </div>

        <div>
          <CanvasActionDropdown
            canvasId={canvas?.canvasId}
            canvasName={canvas?.title}
            afterDelete={() => afterDelete(canvas)}
            afterRename={(newTitle) => afterRename(newTitle, canvas?.canvasId ?? '')}
            handleUseCanvas={() => handleClickCanvas(canvas)}
          />
        </div>
      </div>
    </div>
  );
};

export const CanvasListModal = memo((props: CanvasListProps) => {
  const { visible, setVisible } = props;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dataList, setDataList, loadMore, reload, hasMore, isRequesting } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listCanvases({
        query: queryPayload,
      });
      return res?.data;
    },
    pageSize: 12,
  });

  useEffect(() => {
    if (visible) {
      reload();
    }
  }, [visible]);

  const handleClickCanvas = (canvas: Canvas) => {
    setVisible(false);
    navigate(`/canvas/${canvas.canvasId}`);
  };

  const afterDelete = (canvas: Canvas) => {
    setDataList(dataList.filter((n) => n.canvasId !== canvas.canvasId));
  };

  const afterRename = (newTitle: string, canvasId: string) => {
    setDataList(dataList.map((n) => (n.canvasId === canvasId ? { ...n, title: newTitle } : n)));
  };

  const canvasItems = useMemo(() => {
    return dataList?.map((item) => (
      <CanvasItem
        key={item.canvasId}
        canvas={item}
        handleClickCanvas={handleClickCanvas}
        afterDelete={afterDelete}
        afterRename={afterRename}
      />
    ));
  }, [dataList, handleClickCanvas, afterDelete, afterRename]);

  const handleLoadMore = useCallback(() => {
    if (!isRequesting && hasMore) {
      loadMore();
    }
  }, [isRequesting, hasMore, loadMore]);

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty description={t('common.empty')} />
    </div>
  );

  useEffect(() => {
    if (!visible) {
      setDataList([]);
    }
  }, [visible]);

  return (
    <Modal
      className="canvas-list"
      centered
      title={
        <span className="flex items-center gap-2 text-lg font-medium">
          <IconCanvas /> {t('common.canvas')}
        </span>
      }
      width={1200}
      footer={null}
      open={visible}
      onCancel={() => setVisible(false)}
      focusTriggerAfterClose={false}
    >
      <Spin className="w-full h-full" spinning={isRequesting && dataList.length === 0}>
        <div id="canvasScrollableDiv" className="w-full h-[60vh] overflow-y-auto">
          {dataList.length > 0 ? (
            <InfiniteScroll
              dataLength={dataList.length}
              next={handleLoadMore}
              hasMore={hasMore}
              loader={<Spinner />}
              endMessage={<EndMessage />}
              scrollableTarget="canvasScrollableDiv"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                {canvasItems}
              </div>
            </InfiniteScroll>
          ) : (
            !isRequesting && emptyState
          )}
        </div>
      </Spin>
    </Modal>
  );
});

CanvasListModal.displayName = 'CanvasListModal';
