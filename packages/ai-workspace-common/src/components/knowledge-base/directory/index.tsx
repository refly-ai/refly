import { LOCALE } from '@refly/common-types';
import { time } from '@refly-packages/ai-workspace-common/utils/time';

// styles
import './index.scss';
import { IconFile } from '@arco-design/web-react/icon';
import { Message as message } from '@arco-design/web-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useReloadListState } from '@refly-packages/ai-workspace-common/stores/reload-list-state';
// 类型
import { Resource, RemoveResourceFromCollectionRequest } from '@refly/openapi-schema';
// 请求
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
// 组件
import { ResourceList } from '@refly-packages/ai-workspace-common/components/resource-list';
import { useKnowledgeBaseJumpNewPath } from '@refly-packages/ai-workspace-common/hooks/use-jump-new-path';
import { DeleteDropdownMenu } from '@refly-packages/ai-workspace-common/components/knowledge-base/delete-dropdown-menu';
import { useTranslation } from 'react-i18next';

export const KnowledgeBaseDirectory = () => {
  const { t } = useTranslation();
  const [isFetching, setIsFetching] = useState(false);
  const reloadKnowledgeBaseState = useReloadListState();
  const knowledgeBaseStore = useKnowledgeBaseStore();
  const { jumpToReadResource } = useKnowledgeBaseJumpNewPath();

  const [queryParams] = useSearchParams();
  const kbId = queryParams.get('kbId');
  const resId = queryParams.get('resId');
  const navigate = useNavigate();

  const handleGetDetail = async (collectionId: string, resourceId: string) => {
    setIsFetching(true);
    try {
      const { data: newRes, error } = await getClient().getCollectionDetail({
        query: {
          collectionId,
        },
      });

      if (error) {
        throw error;
      }
      if (!newRes?.success) {
        throw new Error(newRes?.errMsg);
      }

      console.log('newRes', newRes);
      if (newRes.data) {
        knowledgeBaseStore.updateCurrentKnowledgeBase(newRes?.data);
      }

      // 如果没有资源，则跳转到第一个资源
      if (!resourceId) {
        const firstResourceId = newRes?.data?.resources?.[0]?.resourceId;
        if (firstResourceId) {
          jumpToReadResource({
            resId: firstResourceId,
          });
        }
      }
    } catch (err) {
      message.error('获取内容详情失败，请重新刷新试试');
    }
    setIsFetching(false);
  };

  useEffect(() => {
    if (kbId) {
      handleGetDetail(kbId as string, resId as string);
    }
  }, [kbId, resId]);

  useEffect(() => {
    if (reloadKnowledgeBaseState.reloadKnowledgeBaseList) {
      reloadKnowledgeBaseState.setReloadKnowledgeBaseList(false);
      handleGetDetail(kbId as string, resId as string);
    }
  }, [reloadKnowledgeBaseState.reloadKnowledgeBaseList]);

  // 添加 collectionId
  const resources = knowledgeBaseStore?.currentKnowledgeBase?.resources?.map((item) => ({
    ...item,
    collectionId: kbId,
  }));

  const handleDeleteKnowledgeBase = () => {
    /**删除知识库后重定向 */
    let url = '/knowledge-base';
    if (resId) {
      url = `/knowledge-base?resId=${resId}`;
    }
    navigate(url, { replace: true });
  };

  const handleDeleteResource = (item: RemoveResourceFromCollectionRequest) => {
    reloadKnowledgeBaseState.setReloadKnowledgeBaseList(true);
    if (resId === item?.resourceIds[0]) {
      reloadKnowledgeBaseState.setReloadResourceDetail(true);
    }
  };

  return (
    <div className="knowledge-base-directory-container">
      <div className="knowledge-base-directory-intro">
        <div className="intro-body">
          <div className="intro-icon">
            <IconFile style={{ fontSize: 28, color: 'rgba(0, 0, 0, .5)' }} />
          </div>
          <div className="intro-content">
            <div className="intro-title">{knowledgeBaseStore?.currentKnowledgeBase?.title}</div>
            <div className="intro-meta">
              <span>
                {time(knowledgeBaseStore?.currentKnowledgeBase?.updatedAt as string, LOCALE.EN)
                  .utc()
                  .fromNow()}
              </span>
              {' · '}
              <span>
                {t('knowledgeBase.directory.resourceCount', {
                  count: knowledgeBaseStore?.currentKnowledgeBase?.resources?.length || 0,
                })}
              </span>
            </div>
          </div>
        </div>
        {knowledgeBaseStore?.currentKnowledgeBase && (
          <DeleteDropdownMenu
            type="knowledgeBase"
            data={knowledgeBaseStore?.currentKnowledgeBase}
            postDeleteList={handleDeleteKnowledgeBase}
          />
        )}
      </div>
      <div className="knowledge-base-directory-list-container">
        <ResourceList
          placeholder={t('knowledgeBase.directory.searchPlaceholder')}
          isFetching={isFetching}
          resources={resources as Resource[]}
          collectionId={kbId}
          canDelete={true}
          showAdd={true}
          handleItemDelete={(item: RemoveResourceFromCollectionRequest) => handleDeleteResource(item)}
          handleItemClick={(item) => {
            jumpToReadResource({
              resId: item?.resourceId,
            });
          }}
        />
      </div>
    </div>
  );
};
