import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { Clock } from 'lucide-react';

export interface WorkflowFiltersProps {
  hasScheduleFilter: boolean;
  onHasScheduleFilterChange: (value: boolean) => void;
}

export const WorkflowFilters = memo(
  ({ hasScheduleFilter, onHasScheduleFilterChange }: WorkflowFiltersProps) => {
    const { t } = useTranslation();

    const handleClick = () => {
      onHasScheduleFilterChange(!hasScheduleFilter);
    };

    return (
      <Button
        type={hasScheduleFilter ? 'primary' : 'default'}
        className="flex items-center gap-2 !h-[42px]"
        onClick={handleClick}
      >
        <Clock size={16} />
        <span>{t('workflowList.filters.hasSchedule')}</span>
      </Button>
    );
  },
);

WorkflowFilters.displayName = 'WorkflowFilters';
