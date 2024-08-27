import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// components
import { SkillItem } from '@refly-packages/ai-workspace-common/components/skill/skill-management/skill-item';
// store
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';

import { SkillInstance } from '@refly/openapi-schema';

import { ScrollLoading } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { List, Empty } from '@arco-design/web-react';

interface SkillInstanceListProps {
  canGoDetail?: boolean;
}
export const SkillInstanceList = (props: SkillInstanceListProps) => {
  const { t } = useTranslation();
  const { dataList, loadMore, setDataList, hasMore, isRequesting, reload } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listSkillInstances({
        query: queryPayload,
      });
      return res?.data;
    },
    pageSize: 12,
  });

  useEffect(() => {
    loadMore();
  }, []);

  if (dataList.length === 0 && !isRequesting) {
    return <Empty description={t('skill.skillDetail.emptyInstances')} />;
  }
  return (
    <List
      className="skill-instance-list"
      grid={{
        sm: 42,
        md: 16,
        lg: 10,
        xl: 8,
      }}
      wrapperStyle={{ width: '100%' }}
      bordered={false}
      pagination={false}
      dataSource={dataList}
      loading={isRequesting}
      scrollLoading={<ScrollLoading isRequesting={isRequesting} hasMore={hasMore} loadMore={loadMore} />}
      render={(item: SkillInstance, key) => (
        <List.Item
          key={key}
          style={{
            padding: '0',
            width: '100%',
          }}
          className="skill-instance-list__item"
          actionLayout="vertical"
          onClick={() => {}}
        >
          <SkillItem
            itemKey={key}
            data={item}
            source="instance"
            canGoDetail={props.canGoDetail}
            isInstalled={true}
            showExecute={true}
            refreshList={reload}
            postDeleteList={(item: SkillInstance) => setDataList(dataList.filter((n) => n.skillId !== item.skillId))}
          />
        </List.Item>
      )}
    />
  );
};
