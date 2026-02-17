import React from 'react';
import { Collapse, Form, Input, Select, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { ArrowDown, MessageSmile } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { ResourceUpload } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/resource-upload';
import './user-input-collapse.scss';

const RequiredTagText = () => {
  return <span className="text-refly-text-3 flex-shrink-0 mr-0.5">*</span>;
};

const FormItemLabel = ({ name, required }: { name: string; required: boolean }) => {
  return (
    <div className="flex items-center min-w-0">
      {required && <RequiredTagText />}
      <Typography.Paragraph
        ellipsis={{ rows: 1, tooltip: <div className="max-h-[200px] overflow-y-auto">{name}</div> }}
        className="!m-0 text-sm font-medium text-[#D26700] leading-[1.5em] max-w-[150px]"
      >
        {name}
      </Typography.Paragraph>
    </div>
  );
};

interface WorkflowInputFormCollapseProps {
  /**
   * Ant Design Form instance (required when readonly is false and renderFormField is not provided)
   */
  form?: FormInstance;
  /**
   * Workflow variables to display
   */
  workflowVariables: WorkflowVariable[];
  /**
   * Initial values for form fields
   */
  variableValues?: Record<string, any>;
  /**
   * Custom render function for each form field (optional)
   * If not provided, will use built-in rendering logic
   */
  renderFormField?: (variable: WorkflowVariable) => React.ReactNode;
  /**
   * Keys of panels to expand by default
   */
  defaultActiveKey?: string[];
  /**
   * Additional CSS class name
   */
  className?: string;
  /**
   * Whether to render in readonly mode (all fields disabled)
   */
  readonly?: boolean;
  /**
   * Canvas ID (optional, used for readonly mode)
   */
  canvasId?: string;
}

/**
 * A reusable collapse component that wraps workflow input form
 * Supports both editable form mode and readonly display mode
 */
export const WorkflowInputFormCollapse = React.memo<WorkflowInputFormCollapseProps>(
  ({
    form: externalForm,
    workflowVariables,
    variableValues,
    renderFormField: customRenderFormField,
    defaultActiveKey = ['input'],
    className,
    readonly = false,
  }) => {
    const { t } = useTranslation();

    // Create internal form instance if not provided
    const [internalForm] = Form.useForm();
    const form = externalForm || internalForm;

    // Build initial values from workflowVariables if not provided
    const finalVariableValues = React.useMemo(() => {
      if (variableValues) {
        return variableValues;
      }
      // Construct from workflowVariables - convert variable.value to form value format
      const values: Record<string, any> = {};
      for (const variable of workflowVariables) {
        if (!variable.name) continue;

        if (variable.variableType === 'string') {
          // Extract text from value[0].text
          values[variable.name] = variable.value?.[0]?.text ?? '';
        } else if (variable.variableType === 'option') {
          // Extract text array from value[].text
          const valueArray = Array.isArray(variable.value)
            ? variable.value
            : variable.value
              ? [variable.value]
              : [];
          values[variable.name] = valueArray.map((v: any) => v?.text).filter(Boolean);
        } else if (variable.variableType === 'resource') {
          // Convert resource values to UploadFile format
          const fileList: UploadFile[] =
            variable.value?.map((v: any, index: number) => {
              const fileId = v.resource?.fileId;
              const entityId = v.resource?.entityId;

              return {
                uid: fileId || `${index}`,
                name: v.resource?.name || 'file',
                status: 'done' as const,
                url: v.resource?.url,
                storageKey: v.resource?.storageKey,
                fileId,
                entityId,
              } as UploadFile;
            }) ?? [];
          values[variable.name] = fileList;
        }
      }
      return values;
    }, [variableValues, workflowVariables]);

    // Built-in render function for form fields
    const builtInRenderFormField = (variable: WorkflowVariable): React.ReactNode => {
      if (!variable) {
        return null;
      }
      const { name, required, variableType, options, isSingle, resourceTypes } = variable;

      if (variableType === 'string') {
        return (
          <Form.Item
            key={name}
            label={<FormItemLabel name={name} required={required ?? false} />}
            name={name}
            required={false}
            rules={
              readonly
                ? []
                : required
                  ? [{ required: true, message: t('canvas.workflow.variables.inputPlaceholder') }]
                  : []
            }
            data-field-name={name}
            className="!mb-0 [&_.ant-form-item-label]:!pb-3 [&_.ant-form-item-label]:!mb-0"
          >
            <Input
              placeholder={t('canvas.workflow.variables.inputPlaceholder')}
              disabled={readonly}
              data-field-name={name}
              className={cn(
                '!h-[37px] !border-[#E5E5E5] !rounded-xl !px-3 !bg-transparent',
                '!text-sm !leading-[1.5em]',
                readonly ? '!text-[rgba(28,31,35,0.35)]' : '!text-[#1C1F23]',
                'placeholder:!text-[rgba(28,31,35,0.35)]',
                'hover:!border-[#E5E5E5] focus:!border-[#155EEF] focus:!shadow-none',
                'overflow-hidden text-ellipsis whitespace-nowrap',
              )}
            />
          </Form.Item>
        );
      }

      if (variableType === 'option') {
        return (
          <Form.Item
            key={name}
            label={<FormItemLabel name={name} required={required ?? false} />}
            name={name}
            required={false}
            rules={
              readonly
                ? []
                : required
                  ? [{ required: true, message: t('canvas.workflow.variables.selectPlaceholder') }]
                  : []
            }
            className="!mb-0 [&_.ant-form-item-label]:!pb-3 [&_.ant-form-item-label]:!mb-0"
          >
            <Select
              placeholder={t('canvas.workflow.variables.selectPlaceholder')}
              mode={isSingle ? undefined : 'multiple'}
              options={options?.map((opt) => ({ label: opt, value: opt })) ?? []}
              data-field-name={name}
              disabled={readonly}
              className={cn(
                'w-full',
                '[&_.ant-select-selector]:!border-[#E5E5E5] [&_.ant-select-selector]:!rounded-xl',
                '[&_.ant-select-selector]:!px-3 [&_.ant-select-selector]:!min-h-[37px]',
                '[&_.ant-select-selector]:!py-0 [&_.ant-select-selector]:!leading-[35px]',
                '[&_.ant-select-selector]:!text-sm [&_.ant-select-selector]:!text-[rgba(28,31,35,0.35)]',
                '[&_.ant-select-selection-placeholder]:!text-[rgba(28,31,35,0.35)]',
                '[&_.ant-select-selection-item]:!leading-[35px]',
                readonly
                  ? '[&_.ant-select-selection-item]:!text-[rgba(28,31,35,0.35)]'
                  : '[&_.ant-select-selection-item]:!text-[#1C1F23]',
                '[&_.ant-select-selector]:hover:!border-[#E5E5E5]',
                '[&_.ant-select-focused_.ant-select-selector]:!border-[#155EEF]',
                '[&_.ant-select-focused_.ant-select-selector]:!shadow-none',
                '[&_.ant-select-selector]:!bg-transparent',
              )}
            />
          </Form.Item>
        );
      }

      if (variableType === 'resource') {
        return (
          <Form.Item
            key={name}
            label={<FormItemLabel name={name} required={required ?? false} />}
            name={name}
            required={false}
            rules={
              readonly
                ? []
                : required
                  ? [{ required: true, message: t('canvas.workflow.variables.uploadPlaceholder') }]
                  : []
            }
            className="!mb-0 [&_.ant-form-item-label]:!pb-3 [&_.ant-form-item-label]:!mb-0"
          >
            <ResourceUpload
              onUpload={async () => false}
              onRemove={async () => {}}
              onRefresh={isSingle === true ? async () => {} : undefined}
              resourceTypes={resourceTypes}
              disabled={readonly}
              maxCount={isSingle === true ? 1 : 10}
              data-field-name={name}
              hasError={false}
            />
          </Form.Item>
        );
      }

      return null;
    };

    // Use custom render function if provided, otherwise use built-in
    const renderFormField = customRenderFormField || builtInRenderFormField;

    return (
      <div className={cn('overflow-hidden bg-[#F6F6F6] rounded-lg w-full mx-auto', className)}>
        <Collapse
          defaultActiveKey={defaultActiveKey}
          ghost
          expandIcon={({ isActive }) => (
            <ArrowDown
              size={14}
              className={cn('transition-transform', {
                'rotate-180': isActive,
              })}
            />
          )}
          expandIconPosition="end"
          className="workflow-run-collapse"
          items={[
            {
              key: 'input',
              label: (
                <div className="flex items-center w-full min-w-0 gap-2">
                  <MessageSmile size={20} className="flex-shrink-0" />
                  <span className="truncate font-inter font-medium text-[13px] leading-[1.5em]">
                    {t('canvas.workflow.run.inputPanelTitle')}
                  </span>
                </div>
              ),
              children: (
                <div className="p-2">
                  <Form
                    form={form}
                    layout="horizontal"
                    colon={false}
                    className="flex flex-col gap-4"
                    initialValues={finalVariableValues}
                  >
                    {workflowVariables.map((variable) => renderFormField(variable))}
                  </Form>
                </div>
              ),
            },
          ]}
        />
      </div>
    );
  },
);

WorkflowInputFormCollapse.displayName = 'WorkflowInputFormCollapse';
