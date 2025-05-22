import { useEffect } from 'react';

// components
import { useTranslation } from 'react-i18next';
// store
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { useCreateTrigger } from '@refly-packages/ai-workspace-common/hooks/use-create-trigger';
import { useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { useImportNewTriggerModal } from '@refly-packages/ai-workspace-common/stores/import-new-trigger-modal';

import './index.scss';
import { SkillTrigger } from '@refly/openapi-schema';

import { ScrollLoading } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { List, Empty, Row, Col, Divider, Switch, Popconfirm } from 'antd';
import {
  DeleteOutlined,
  ScheduleOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';

// 不再需要这些行，因为我们直接从antd导入Row和Col
// const Row = Grid.Row;
// const Col = Grid.Col;

export const SkillTriggers = () => {
  const { t } = useTranslation();
  const createTrigger = useCreateTrigger();
  const importNewTriggerModal = useImportNewTriggerModal();
  const [searchParams] = useSearchParams();
  const skillId = searchParams.get('skillId') as string;

  const { dataList, loadMore, hasMore, isRequesting, setDataList, reload } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listSkillTriggers({
        query: { ...queryPayload, skillId },
      });
      return res?.data;
    },
    pageSize: 12,
  });

  const TriggerCard = (props: { trigger: SkillTrigger }) => {
    const { t } = useTranslation();
    const { trigger } = props;
    const { simpleEventName, timerConfig } = trigger;
    let eventType = 'simpleEvent';
    let eventMessage = t(`skill.newTriggerModal.${simpleEventName}`);
    if (timerConfig) {
      eventType = 'timer';
      eventMessage = `${timerConfig.datetime}（${t(`skill.newTriggerModal.${timerConfig.repeatInterval}`)}）`;
    }
    const updateTriggerStatus = async (val: boolean) => {
      const error = await createTrigger.updateTriggerStatus(trigger, val);
      if (!error) {
        reload();
      }
    };
    const handleUpdateTrigger = () => {
      importNewTriggerModal.setTrigger(trigger);
      importNewTriggerModal.setShowtriggerModall(true);
    };

    const deleteTrigger = async () => {
      const error = await createTrigger.deleteTrigger(trigger);
      if (!error) {
        setDataList(dataList.filter((n: SkillTrigger) => n.triggerId !== trigger.triggerId));
      }
    };

    return (
      <div className="skill-triggers__card">
        <Row align="middle" justify="center">
          <Col span={4} className="skill-triggers__card-col ellipsis">
            {trigger.displayName}
          </Col>

          <Col span={1}>
            <Divider type="vertical" />
          </Col>

          <Col span={4} className="skill-triggers__card-col">
            {eventType === 'timer' && (
              <div>
                <ScheduleOutlined style={{ marginRight: 8 }} />
                {t('skill.newTriggerModal.timer')}
              </div>
            )}
            {eventType === 'simpleEvent' && (
              <div>
                <ThunderboltOutlined style={{ marginRight: 8 }} />
                {t('skill.newTriggerModal.simpleEvent')}
              </div>
            )}
          </Col>

          <Col span={1}>
            <Divider type="vertical" />
          </Col>

          <Col span={14} className="skill-triggers__card-right">
            <div>{eventMessage}</div>
            <div className="actions">
              <Switch
                className="actions-item"
                size="small"
                checked={trigger.enabled}
                onChange={(val) => updateTriggerStatus(val)}
              />
              <ToolOutlined
                className="actions-item"
                style={{ fontSize: 16, margin: '0 20px' }}
                onClick={handleUpdateTrigger}
              />
              <Popconfirm
                title={t('common.deleteConfirmMessage')}
                placement="bottomRight"
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={deleteTrigger}
              >
                <DeleteOutlined className="actions-item" style={{ fontSize: 16 }} />
              </Popconfirm>
            </div>
          </Col>
        </Row>
      </div>
    );
  };

  useEffect(() => {
    loadMore();
  }, []);

  useEffect(() => {
    if (importNewTriggerModal.reloadTriggerList) {
      reload();
      importNewTriggerModal.setReloadTriggerList(false);
    }
  }, [importNewTriggerModal.reloadTriggerList]);

  if (dataList.length === 0 && !isRequesting) {
    return <Empty description={t('skill.skillDetail.emptyTriggers')} />;
  }

  return (
    <List
      className="skill-triggers"
      style={{ width: '100%' }}
      bordered={false}
      dataSource={dataList}
      loading={isRequesting}
      renderItem={(item: SkillTrigger, key) => (
        <List.Item
          key={item?.triggerId + key}
          style={{
            padding: '0',
            width: '100%',
          }}
          className="skill-triggers__list-item"
          onClick={() => {}}
        >
          <TriggerCard trigger={item} />
        </List.Item>
      )}
    >
      {hasMore && (
        <ScrollLoading isRequesting={isRequesting} hasMore={hasMore} loadMore={loadMore} />
      )}
    </List>
  );
};
