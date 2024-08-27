import { useState, useEffect } from 'react';
import { time } from '@refly-packages/ai-workspace-common/utils/time';

// components
import { useTranslation } from 'react-i18next';
// store
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';

import './index.scss';
import { SkillJob } from '@refly/openapi-schema';
import { LOCALE } from '@refly/common-types';

import { ScrollLoading } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { List, Empty, Grid, Divider } from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconLoading,
  IconCloseCircle,
  IconSchedule,
  IconMessage,
  IconThunderbolt,
  IconFolderAdd,
  IconStorage,
  IconFile,
  IconLink,
  IconRefresh,
} from '@arco-design/web-react/icon';

const Row = Grid.Row;
const Col = Grid.Col;

type eventType = 'conversation' | 'timer' | 'simpleEvent';

interface SkillJobsProps {
  reloadList?: boolean;
  setReloadList?: (val: boolean) => void;
}

export const SkillJobs = (props: SkillJobsProps) => {
  const { reloadList, setReloadList } = props;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const skillId = searchParams.get('skillId') as string;
  const { t } = useTranslation();

  const { dataList, setDataList, loadMore, hasMore, isRequesting, reload } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listSkillJobs({
        query: { ...queryPayload, skillId },
      });
      return res?.data;
    },
    pageSize: 12,
  });

  useEffect(() => {
    loadMore();
  }, []);

  useEffect(() => {
    if (reloadList) {
      reload();
      setReloadList(false);
    }
  }, [reloadList]);

  const JobStatus = (props: { status: string }) => {
    switch (props.status) {
      case 'finish':
        return <IconCheckCircle style={{ color: '#00B42A' }} />;
      case 'failed':
        return <IconCloseCircle style={{ color: '#D80101' }} />;
      case 'running':
        return <IconLoading style={{ color: '#C9A300' }} />;
      default:
        return null;
    }
  };

  const TriggerEvent = (props: { evenT: eventType; eventMessage: string }) => {
    return (
      <div className="skill-jobs__card-event">
        {props.evenT === 'conversation' && <IconMessage className="event-icon" />}
        {props.evenT === 'timer' && <IconSchedule className="event-icon" />}
        {props.evenT === 'simpleEvent' && <IconThunderbolt className="event-icon" />}
        <div className="ellipsis event-message">{props.eventMessage || '手动运行'}</div>
      </div>
    );
  };

  type cType = 'collections' | 'notes' | 'resources' | 'urls';

  const ContextAttachment = (props: { contextType: cType; contentList: string[] }) => {
    const { contextType, contentList = [] } = props;
    const Icon = (props: { type: cType }) => {
      switch (props.type) {
        case 'collections':
          return <IconFolderAdd style={{ marginRight: 8 }} />;
        case 'notes':
          return <IconFile style={{ marginRight: 8 }} />;
        case 'resources':
          return <IconStorage style={{ marginRight: 8 }} />;
        case 'urls':
          return <IconLink style={{ marginRight: 8 }} />;
        default:
          return null;
      }
    };

    return (
      <div className="skill-jobs__card-context">
        <Icon type={contextType} />
        <div className="skill-jobs__card-context-content">
          {contentList.map((item, index) => (
            <div className="ellipsis context-item" key={index}>
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const JobCard = (props: { job: SkillJob }) => {
    const { t, i18n } = useTranslation();
    const language = i18n.languages?.[0];
    const { job } = props;
    let eventT: eventType = null;
    let eventMessage = '';
    const { conversation, trigger, updatedAt } = job;
    if (conversation) {
      eventT = 'conversation';
      eventMessage = conversation.title;
    } else if (trigger) {
      eventT = trigger.triggerType;
      if (eventT === 'simpleEvent') {
        eventMessage = t(`skill.newTriggerModal.${trigger.simpleEventName}`);
      } else {
        eventMessage = t(`skill.newTriggerModal.${trigger.timerConfig?.repeatInterval}`);
      }
    }

    const handleClickJob = () => {
      const { jobId } = job;
      if (!jobId) return;
      navigate(`/skill-detail?skillId=${skillId}&jobId=${jobId}`, { replace: true });
    };

    const { collections, notes, resources, urls } = job.context;
    return (
      <div className="skill-jobs__card" onClick={handleClickJob}>
        <Row align="center" justify="center">
          <Col span={1} className="skill-jobs__card-col">
            <JobStatus status={job.jobStatus} />
          </Col>
          <Col span={1} className="skill-jobs__card-col">
            <Divider type="vertical" />
          </Col>
          <Col span={5}>
            <TriggerEvent evenT={eventT} eventMessage={eventMessage} />
          </Col>
          <Col span={1}>
            <Divider type="vertical" />
          </Col>
          <Col span={12}>
            <div className="skill-jobs__card-contexts">
              {collections?.length && (
                <ContextAttachment contextType="collections" contentList={collections.map((item) => item.title)} />
              )}
              {resources?.length && (
                <ContextAttachment contextType="collections" contentList={resources.map((item) => item.title)} />
              )}
              {notes?.length && <ContextAttachment contextType="notes" contentList={notes.map((item) => item.title)} />}
              {urls?.length ? <ContextAttachment contextType="urls" contentList={urls} /> : null}
            </div>
          </Col>
          <Col span={4} className="skill-jobs__card-col">
            {time(updatedAt, language as LOCALE)
              .utc()
              .fromNow()}
            <IconRefresh style={{ marginLeft: 12, color: '#666666' }} />
          </Col>
        </Row>
      </div>
    );
  };

  if (dataList.length === 0 && !isRequesting) {
    return <Empty description={t('skill.skillDetail.emptyJobs')} />;
  }
  return (
    <List
      className="skill-jobs"
      wrapperStyle={{ width: '100%' }}
      bordered={false}
      split={false}
      pagination={false}
      dataSource={dataList}
      loading={isRequesting}
      scrollLoading={<ScrollLoading isRequesting={isRequesting} hasMore={hasMore} loadMore={loadMore} />}
      render={(item: SkillJob, key) => (
        <List.Item
          key={item?.jobId + key}
          style={{
            padding: '0',
            width: '100%',
          }}
          actionLayout="vertical"
          onClick={() => {}}
        >
          <JobCard job={item} />
        </List.Item>
      )}
    />
  );
};
