import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PilotStep, PilotStepStatus } from '@refly/openapi-schema';
import { Tag } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';

// Status icon mapping for pilot steps
export const StepStatusIcon = memo(({ status }: { status?: PilotStepStatus }) => {
  if (!status) return <QuestionCircleOutlined className="text-gray-400" />;

  switch (status) {
    case 'init':
      return <ClockCircleOutlined className="text-blue-500" />;
    case 'executing':
      return <LoadingOutlined className="text-blue-500" spin />;
    case 'finish':
      return <CheckCircleOutlined className="text-green-500" />;
    case 'failed':
      return <CloseCircleOutlined className="text-red-500" />;
    default:
      return <QuestionCircleOutlined className="text-gray-400" />;
  }
});

StepStatusIcon.displayName = 'StepStatusIcon';

export interface PilotStepItemProps {
  step: PilotStep;
  onClick?: (step: PilotStep) => void;
  isDetailed?: boolean;
}

export const PilotStepItem = memo(({ step, onClick }: PilotStepItemProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];

  const handleClick = useMemo(() => {
    if (!onClick) return undefined;
    return () => onClick(step);
  }, [onClick, step]);

  const { actionMeta, input } = step?.actionResult ?? {};
  const skillName = actionMeta?.name;
  const skillDisplayName = skillName ? t(`${skillName}.name`, { ns: 'skill' }) : '';

  return (
    <div
      className="flex flex-col gap-1 border border-solid hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 rounded-md p-3 mb-3 bg-white dark:bg-gray-800 cursor-pointer transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <StepStatusIcon status={step.status} />
          <span className="ml-2 font-medium text-sm truncate max-w-64">{step.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          {step.epoch !== undefined && (
            <Tag color="blue">{t('pilot.epoch', { count: step.epoch + 1 })}</Tag>
          )}
        </div>
      </div>

      {step.actionResult && (
        <div className="px-4 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-1">
            {getSkillIcon(skillName)}
            {skillDisplayName}
          </div>
          <div className="line-clamp-3 py-1">{input.query}</div>
        </div>
      )}

      <div className="text-xs px-4 text-gray-500 dark:text-gray-400">
        {time(step?.createdAt, language as LOCALE)
          ?.utc()
          ?.fromNow()}
      </div>
    </div>
  );
});

PilotStepItem.displayName = 'PilotStepItem';
