import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType, PilotSession } from '@refly/openapi-schema';
import { Empty, List, Skeleton } from 'antd';
import { SessionStatusTag } from './session-status-tag';
import { cn } from '@refly/utils/cn';
import { useListPilotSessions } from '@refly-packages/ai-workspace-common/queries/queries';
import InfiniteScroll from 'react-infinite-scroll-component';

export interface PilotListProps {
  show: boolean;
  className?: string;
  limit?: number;
  targetId?: string;
  targetType?: EntityType;
  onSessionClick: (session: PilotSession) => void;
}

export const PilotList = memo(
  ({ className, limit = 10, targetId, targetType, onSessionClick, show }: PilotListProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [allSessions, setAllSessions] = useState<PilotSession[]>([]);

    // Fetch pilot sessions
    const {
      data: sessionsData,
      isLoading,
      refetch,
    } = useListPilotSessions({
      query: {
        targetId,
        targetType,
        page,
        pageSize: limit,
      },
      throwOnError: true,
    });

    useEffect(() => {
      if (sessionsData?.data) {
        if (page === 1) {
          setAllSessions(sessionsData.data);
        } else {
          setAllSessions((prev) => [...prev, ...sessionsData.data]);
        }

        // Check if we have more data to load
        setHasMore(sessionsData.data.length === limit);
      }
    }, [sessionsData, limit, page]);

    const handleSessionClick = useCallback(
      (session: PilotSession) => {
        onSessionClick(session);
      },
      [navigate, onSessionClick],
    );

    const formatDate = useCallback((dateString?: string) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleString();
      } catch (e) {
        console.error(e);
        return dateString;
      }
    }, []);

    const loadMoreData = useCallback(() => {
      setPage((prevPage) => prevPage + 1);
    }, []);

    useEffect(() => {
      if (show) {
        refetch();
      } else {
        // Reset to initial state when component becomes visible
        setHasMore(true);
        setPage(1);
        setAllSessions([]);
      }
    }, [show]);

    if (isLoading && allSessions.length === 0) {
      return (
        <div className={cn('p-4 bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      );
    }

    if (allSessions.length === 0) {
      return (
        <div
          className={cn('p-4 bg-white dark:bg-gray-800 rounded-lg shadow text-center', className)}
        >
          <Empty
            description={t('pilot.noSessions', { defaultValue: 'No pilot sessions found' })}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      );
    }

    return (
      <div
        className={cn('rounded-lg shadow h-[200px] w-80 overflow-y-auto', className)}
        id="scrollableDiv"
      >
        <InfiniteScroll
          dataLength={allSessions.length}
          next={loadMoreData}
          hasMore={hasMore}
          loader={<Skeleton active paragraph={{ rows: 1 }} className="p-2" />}
          scrollableTarget="scrollableDiv"
          endMessage={<p className="text-center text-xs text-gray-500 p-2">{t('common.noMore')}</p>}
        >
          <List
            dataSource={allSessions}
            renderItem={(session) => (
              <List.Item
                className="!px-2 !py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => handleSessionClick(session)}
              >
                <List.Item.Meta
                  title={
                    <div className="flex items-center">
                      <span className="text-xs font-medium">{session.title}</span>
                      <SessionStatusTag
                        status={session.status}
                        className="ml-2 h-5 flex items-center"
                      />
                    </div>
                  }
                  description={
                    <div className="flex flex-col mt-1">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {t('pilot.createdAt', { defaultValue: 'Created At' })}:{' '}
                        {formatDate(session.createdAt)}
                      </span>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </InfiniteScroll>
      </div>
    );
  },
);

PilotList.displayName = 'PilotList';
