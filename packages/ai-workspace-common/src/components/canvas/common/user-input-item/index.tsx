import type { WorkflowVariable } from '@refly/openapi-schema';
import { memo, useMemo } from 'react';
import { Close } from 'refly-icons';
import { Button, Popover } from 'antd';
import { VariableHoverCard } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/variable-hover-card';

interface UserInputItemProps {
  variable: WorkflowVariable;
  classnames?: string;
  readonly?: boolean;
  onClose?: () => void;
}

export const UserInputItem = memo(
  ({ variable, classnames = '', readonly = false, onClose }: UserInputItemProps) => {
    const { name, variableType, options, value, required } = variable;
    const displayValue = useMemo(() => {
      if (variableType === 'resource') {
        return value?.[0]?.resource?.name ?? '';
      }
      if (variableType === 'option') {
        return options?.join(', ') ?? '';
      }
      return value?.[0]?.text ?? '';
    }, [variableType, options, value]);

    return (
      <Popover
        content={
          <VariableHoverCard
            variableType={variableType}
            label={name}
            options={options}
            value={value}
          />
        }
        placement="top"
        overlayClassName="variable-hover-card-popover"
        trigger="hover"
        arrow={false}
        mouseEnterDelay={0.3}
        overlayInnerStyle={{ padding: 0, backgroundColor: 'transparent', boxShadow: 'none' }}
      >
        <div
          className={`flex items-center gap-1 h-5 px-1 rounded-[4px] border-[0.5px] border-solid border-refly-Card-Border cursor-pointer select-none text-xs ${classnames ?? ''}`}
        >
          {required && <div className="text-refly-text-3 flex-shrink-0">*</div>}
          <div className="text-refly-func-warning-hover truncate max-w-[100px] truncate">
            {name}
          </div>
          <div className="text-refly-text-1 max-w-[100px] truncate ml-1">{displayValue}</div>

          {onClose && !readonly && (
            <Button
              type="text"
              className="!w-[14px] !h-[14px] !p-0 !rounded-[2px]"
              icon={<Close size={14} />}
              onClick={onClose}
            />
          )}
        </div>
      </Popover>
    );
  },
);

UserInputItem.displayName = 'UserInputItem';
