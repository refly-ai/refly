import { memo, useMemo } from 'react';
import { Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { PilotStep, PilotStepStatus } from '@refly/openapi-schema';
import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { FaCheck } from 'react-icons/fa6';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';

// Status icon mapping for pilot steps
export const StepStatusIcon = memo(({ status }: { status?: PilotStepStatus }) => {
  if (!status) return <QuestionCircleOutlined className="text-gray-400" />;

  switch (status) {
    case 'init':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <ClockCircleOutlined className="text-gray-400 dark:text-gray-500" />
        </div>
      );
    case 'executing':
      return (
        <div className="w-6 h-6 flex items-center justify-center">
          <SyncOutlined spin className="text-yellow-500" />
        </div>
      );
    case 'finish':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <FaCheck className="w-4 h-4 text-green-500" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <CloseCircleOutlined className="text-red-500" />
        </div>
      );
    default:
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <QuestionCircleOutlined className="text-gray-400" />
        </div>
      );
  }
});

StepStatusIcon.displayName = 'StepStatusIcon';

export interface PilotStepItemProps {
  step: PilotStep;
  onClick?: (step: PilotStep) => void;
}

export const PilotStepItem = memo(({ step, onClick }: PilotStepItemProps) => {
  const { t } = useTranslation();
  const { actionMeta } = step?.actionResult ?? {};
  const skillName = actionMeta?.name;
  const skillDisplayName = skillName ? t(`${skillName}.name`, { ns: 'skill' }) : '';

  const handleClick = useMemo(() => {
    if (!onClick) return undefined;
    return () => onClick(step);
  }, [onClick, step]);

  return (
    <div
      className="flex items-center p-1 cursor-pointer rounded-md transition-colors w-full max-w-full text-gray-600 hover:text-gray-800 dark:text-gray-400 hover:dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
      onClick={handleClick}
    >
      <div className="mr-2 flex-shrink-0">
        <StepStatusIcon status={step.status} />
      </div>

      <div className="flex items-center px-2 py-1 flex-grow min-w-0">
        <span className="truncate text-sm block max-w-[380px]">{step?.name ?? ''}</span>

        {step.actionResult && (
          <>
            <Divider type="vertical" className="h-3" />
            <span className="flex items-center gap-1 text-xs opacity-70">
              {getSkillIcon(skillName)}
              {skillDisplayName}
            </span>
          </>
        )}
      </div>
    </div>
  );
});

PilotStepItem.displayName = 'PilotStepItem';
