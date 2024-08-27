import { useState, useEffect } from 'react';

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
import { List, Empty, Grid, Divider, Switch, Popconfirm } from '@arco-design/web-react';
import { IconDelete, IconSchedule, IconThunderbolt, IconTool } from '@arco-design/web-react/icon';

const Row = Grid.Row;
const Col = Grid.Col;

interface SkillTriggersProps {}

export const SkillTriggers = (props: SkillTriggersProps) => {
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
      eventMessage = timerConfig.datetime + `（${t(`skill.newTriggerModal.${timerConfig.repeatInterval}`)}）`;
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
        <Row align="center" justify="center">
          <Col span={4} className="skill-triggers__card-col ellipsis">
            {trigger.displayName}
          </Col>

          <Col span={1}>
            <Divider type="vertical" />
          </Col>

          <Col span={4} className="skill-triggers__card-col">
            {eventType === 'timer' && (
              <div>
                <IconSchedule style={{ marginRight: 8 }} />
                {t('skill.newTriggerModal.timer')}
              </div>
            )}

            {eventType === 'simpleEvent' && (
              <div>
                <IconThunderbolt style={{ marginRight: 8 }} />
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
                type="round"
                size="small"
                checked={trigger.enabled}
                onChange={(val) => updateTriggerStatus(val)}
              />
              <IconTool
                className="actions-item"
                style={{ fontSize: 16, margin: '0 20px' }}
                onClick={handleUpdateTrigger}
              />
              <Popconfirm
                focusLock
                title={t('common.deleteConfirmMessage')}
                position="br"
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onOk={deleteTrigger}
              >
                <IconDelete className="actions-item" style={{ fontSize: 16 }} />
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
    console.log('importNewTriggerModal.reloadTriggerList]', importNewTriggerModal.reloadTriggerList);
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
      wrapperStyle={{ width: '100%' }}
      bordered={false}
      split={false}
      pagination={false}
      dataSource={dataList}
      loading={isRequesting}
      scrollLoading={<ScrollLoading isRequesting={isRequesting} hasMore={hasMore} loadMore={loadMore} />}
      render={(item: SkillTrigger, key) => (
        <List.Item
          key={item?.triggerId + key}
          style={{
            padding: '0',
            width: '100%',
          }}
          className="skill-triggers__list-item"
          actionLayout="vertical"
          onClick={() => {}}
        >
          <TriggerCard trigger={item} />
        </List.Item>
      )}
    />
  );
};
