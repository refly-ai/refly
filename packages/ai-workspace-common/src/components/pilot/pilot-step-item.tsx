import { memo, useMemo } from 'react';
import { PilotStep, PilotStepStatus } from '@refly/openapi-schema';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import { Cancelled, Finished, Pending, Running1 } from 'refly-icons';

// Status icon mapping for pilot steps
export const StepStatusIcon = memo(({ status }: { status?: PilotStepStatus }) => {
  if (!status) return <QuestionCircleOutlined className="text-gray-400" />;

  switch (status) {
    case 'init':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <Pending className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        </div>
      );
    case 'executing':
      return (
        <div className="w-6 h-6 flex items-center justify-center">
          <Running1 className="w-4 h-4 animate-spin" />
        </div>
      );
    case 'finish':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <Finished className="w-4 h-4" color="var(--refly-primary-default)" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <Cancelled className="w-4 h-4" color="var(--refly-func-danger-default)" />
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
  const handleClick = useMemo(() => {
    if (!onClick) return undefined;
    return () => onClick(step);
  }, [onClick, step]);

  return (
    <motion.div
      className="flex items-center p-1 mt-2 cursor-pointer rounded-md transition-colors w-full max-w-full text-gray-600 hover:text-gray-800 dark:text-gray-400 hover:dark:text-gray-200 dark:hover:bg-gray-800 bg-[#F4F4F4] border border-gray-100 dark:border-gray-700 dark:bg-refly-bg-content-z2"
      onClick={handleClick}
      whileHover={{
        scale: 1.02,
      }}
      whileTap={{
        scale: 0.98,
        transition: { duration: 0.1 },
      }}
      layout
    >
      <div className="mr-2 flex-shrink-0">
        <StepStatusIcon status={step.status} />
      </div>

      <div className="flex items-center py-1 flex-grow min-w-0">
        <span className="truncate text-sm block max-w-[380px]">{step?.name ?? ''}</span>
      </div>
    </motion.div>
  );
});

PilotStepItem.displayName = 'PilotStepItem';
