import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PilotSessionStatus } from '@refly/openapi-schema';
import { Tag } from 'antd';
import { SyncOutlined } from '@ant-design/icons';

export interface SessionStatusTagProps {
  status: PilotSessionStatus;
  className?: string;
}

export const SessionStatusTag = memo(({ status, className }: SessionStatusTagProps) => {
  const { t } = useTranslation();

  const color = useMemo(() => {
    switch (status) {
      case 'init':
        return 'blue';
      case 'executing':
      case 'waiting':
        return 'processing';
      case 'finish':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  }, [status]);

  return (
    <Tag color={color} className={className}>
      {status === 'executing' || status === 'waiting' ? (
        <SyncOutlined spin className="w-3 h-3" />
      ) : null}
      <span className="text-[10px]">{t(`pilot.status.${status}`, { defaultValue: status })}</span>
    </Tag>
  );
});

SessionStatusTag.displayName = 'SessionStatusTag';
