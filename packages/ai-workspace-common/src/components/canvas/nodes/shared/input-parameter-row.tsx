import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiText } from 'react-icons/bi';
import { Button, message, Popconfirm, Popover, Typography } from 'antd';
import cn from 'classnames';
import { Attachment, List, Edit, Delete, Image, Doc2, Video, Audio } from 'refly-icons';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { VariableHoverCard } from './variable-hover-card';

const { Paragraph } = Typography;

export const VARIABLE_TYPE_ICON_MAP = {
  string: BiText,
  option: List,
  resource: Attachment,
};

export const RESOURCE_TYPE_ICON_MAP = {
  image: Image,
  document: Doc2,
  video: Video,
  audio: Audio,
};

export interface InputParameterRowProps {
  variable: WorkflowVariable;
  readonly?: boolean;
  onEdit?: (variable: WorkflowVariable) => void;
  onDelete?: (variable: WorkflowVariable) => void;
  isHighlighted?: boolean;
  isPreview?: boolean;
}

export const InputParameterRow = memo(
  ({
    variable,
    readonly = false,
    onEdit,
    onDelete,
    isHighlighted = false,
    isPreview = false,
  }: InputParameterRowProps) => {
    const { t } = useTranslation();
    const [isPopconfirmOpen, setIsPopconfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const { name, variableType, options, value, required } = variable;
    const displayValue = useMemo(() => {
      if (variableType === 'option') {
        return options?.join(', ') ?? '';
      }
      if (variableType === 'resource') {
        return value?.[0]?.resource?.name ?? '';
      }
      return value?.[0]?.text ?? '';
    }, [variableType, options, value]);

    const VariableIcon = useMemo(() => {
      const size = isPreview ? 16 : 14;
      if (variableType === 'option') {
        return <List size={size} color="var(--refly-text-3)" className="flex-shrink-0" />;
      }
      if (variableType === 'resource') {
        const resourceType = value?.[0]?.resource?.fileType;
        const Icon =
          RESOURCE_TYPE_ICON_MAP[resourceType as keyof typeof RESOURCE_TYPE_ICON_MAP] ?? Attachment;
        return <Icon size={size} color="var(--refly-text-3)" className="flex-shrink-0" />;
      }
      return <BiText size={size} color="var(--refly-text-3)" className="flex-shrink-0" />;
    }, [variableType, value, isPreview]);

    const handleDeleteVariable = async (variable: WorkflowVariable) => {
      try {
        setIsDeleting(true);
        await onDelete?.(variable);
        message.success(
          t('canvas.workflow.variables.deleteSuccess') || 'Variable deleted successfully',
        );
      } catch (error) {
        console.error('Failed to delete variable:', error);
        message.error(t('common.deleteFailed') || 'Failed to delete');
      } finally {
        setIsDeleting(false);
      }
    };

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
        placement="right"
        arrow={false}
        overlayClassName="variable-hover-card-popover"
        trigger="hover"
        mouseEnterDelay={0.3}
        overlayInnerStyle={{ padding: 0, backgroundColor: 'transparent', boxShadow: 'none' }}
      >
        <div
          className={cn(
            'group flex gap-2 items-center justify-between py-1.5 px-3 cursor-default hover:bg-refly-tertiary-hover transition-colors cursor-pointer',
            isPreview
              ? 'h-[37px] border-solid border-[1px] border-refly-Card-Border rounded-xl'
              : 'h-[30px] bg-refly-bg-control-z0 rounded-[4px]',
            isHighlighted && 'bg-refly-bg-control-z1',
          )}
        >
          <div className="flex items-center flex-1 min-w-0">
            {required && <div className="text-refly-text-3 flex-shrink-0 mr-0.5">*</div>}
            <div className="flex items-center flex-1 min-w-0 overflow-hidden">
              <div
                className={cn(
                  'text-refly-func-warning-hover truncate min-w-0 flex-1 shrink basis-[80px] max-w-fit',
                  isPreview ? 'text-sm' : 'text-xs',
                )}
              >
                {name}
              </div>
              {displayValue && (
                <div
                  className={cn(
                    'text-refly-text-3 truncate ml-1 min-w-0 flex-grow-0 shrink-[100] basis-auto',
                    isPreview ? 'text-sm' : 'text-xs',
                  )}
                >
                  {displayValue}
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center gap-1">
            {VariableIcon}
            {!readonly && (
              <div
                className={`items-center gap-1 flex-shrink-0 ${
                  isPopconfirmOpen ? 'flex' : 'hidden group-hover:flex'
                }`}
              >
                <Button
                  type="text"
                  size="small"
                  className="ml-1"
                  icon={<Edit size={16} />}
                  onClick={() => onEdit?.(variable)}
                />
                <Popconfirm
                  icon={null}
                  title={
                    <Paragraph
                      className="!m-0 text-[16px] font-semibold leading-[26px] p-3 max-w-[400px]"
                      ellipsis={{
                        rows: 1,
                        tooltip: (
                          <div className="max-h-[200px] overflow-y-auto">
                            {t('canvas.workflow.variables.deleteUserInput', { value: name })}
                          </div>
                        ),
                      }}
                    >
                      {t('canvas.workflow.variables.deleteUserInput', { value: name })}
                    </Paragraph>
                  }
                  description={
                    <div className="w-[400px] leading-5 px-3 pt-1 pb-2">
                      {t('canvas.workflow.variables.deleteConfirm')}
                    </div>
                  }
                  arrow={false}
                  onConfirm={() => handleDeleteVariable(variable)}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  onOpenChange={setIsPopconfirmOpen}
                  okButtonProps={{ loading: isDeleting, className: 'w-20 h-8 mb-3 mr-3' }}
                  cancelButtonProps={{ className: 'w-20 h-8 mb-3' }}
                  placement="topRight"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<Delete size={16} />}
                    className={isPopconfirmOpen ? 'bg-refly-tertiary-hover' : ''}
                  />
                </Popconfirm>
              </div>
            )}
          </div>
        </div>
      </Popover>
    );
  },
);

InputParameterRow.displayName = 'InputParameterRow';
