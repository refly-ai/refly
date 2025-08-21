import React, { useState, useEffect, useCallback } from 'react';
import { Dropdown, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd';
import { Settings, Edit, Delete } from 'refly-icons';
import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { WorkflowVariable } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

interface WorkflowVariablesDropdownProps {
  canvasId: string;
  className?: string;
}

interface VariableFormData {
  name: string;
  value: string[] | string;
  description?: string;
}

export const WorkflowVariablesDropdown: React.FC<WorkflowVariablesDropdownProps> = ({
  canvasId,
  className,
}) => {
  const { t } = useTranslation();
  const [variables, setVariables] = useState<WorkflowVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVariable, setEditingVariable] = useState<WorkflowVariable | null>(null);
  const [form] = Form.useForm<VariableFormData>();
  const { readonly } = useCanvasContext();

  // Load workflow variables
  const loadVariables = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await getClient().getWorkflowVariables({
        query: { canvasId },
      });
      if (error) {
        throw error;
      }
      setVariables(data?.data ?? []);
    } catch (error) {
      console.error('Failed to load workflow variables:', error);
      message.error(t('canvas.workflow.variables.loadError') || 'Failed to load variables');
    } finally {
      setLoading(false);
    }
  }, [canvasId, t]);

  // Save workflow variables
  const saveVariables = useCallback(
    async (newVariables: WorkflowVariable[]) => {
      try {
        setLoading(true);
        const { error } = await getClient().updateWorkflowVariables({
          body: {
            canvasId,
            variables: newVariables,
          },
        });
        if (error) {
          throw error;
        }
        setVariables(newVariables);
        message.success(
          t('canvas.workflow.variables.saveSuccess') || 'Variables saved successfully',
        );
      } catch (error) {
        console.error('Failed to save workflow variables:', error);
        message.error(t('canvas.workflow.variables.saveError') || 'Failed to save variables');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [canvasId, t],
  );

  // Add new variable
  const handleAddVariable = () => {
    setEditingVariable(null);
    form.resetFields();
    setModalVisible(true);
  };

  // Edit variable
  const handleEditVariable = (variable: WorkflowVariable) => {
    setEditingVariable(variable);
    form.setFieldsValue({
      name: variable.name,
      value: Array.isArray(variable.value) ? variable.value.join(', ') : variable.value,
      description: variable.description,
    });
    setModalVisible(true);
  };

  // Delete variable
  const handleDeleteVariable = async (variableName: string) => {
    const newVariables = variables.filter((v) => v.name !== variableName);
    await saveVariables(newVariables);
  };

  // Save variable (add or edit)
  const handleSaveVariable = async (values: VariableFormData) => {
    const { name, value, description } = values;

    // Check for duplicate names (excluding the current editing variable)
    const existingVariable = variables.find((v) => v.name === name);
    if (existingVariable && (!editingVariable || editingVariable.name !== name)) {
      message.error(t('canvas.workflow.variables.duplicateName') || 'Variable name already exists');
      return;
    }

    // Convert string value to array format
    const valueArray =
      typeof value === 'string'
        ? value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : value;

    let newVariables: WorkflowVariable[];

    if (editingVariable) {
      // Edit existing variable
      newVariables = variables.map((v) =>
        v.name === editingVariable.name ? { name, value: valueArray, description } : v,
      );
    } else {
      // Add new variable
      newVariables = [...variables, { name, value: valueArray, description }];
    }

    await saveVariables(newVariables);
    setModalVisible(false);
    form.resetFields();
  };

  // Load variables on mount
  useEffect(() => {
    loadVariables();
  }, [loadVariables]);

  const dropdownItems = [
    {
      key: 'header',
      label: (
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <span className="font-medium">
            {t('canvas.workflow.variables.title') || 'Workflow Variables'}
          </span>
          {!readonly && (
            <Button
              type="text"
              size="small"
              icon={<IconPlus size={14} />}
              onClick={handleAddVariable}
              className="!p-1"
            />
          )}
        </div>
      ),
      disabled: true,
    },
    ...variables.map((variable) => ({
      key: variable.name,
      label: (
        <div className="flex items-center justify-between p-2 hover:bg-gray-50">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{variable.name}</div>
            <div className="text-xs text-gray-500 truncate">
              {Array.isArray(variable.value) ? variable.value.join(', ') : variable.value}
            </div>
            {variable.description && (
              <div className="text-xs text-gray-400 truncate">{variable.description}</div>
            )}
          </div>
          {!readonly && (
            <Space size="small" className="ml-2">
              <Button
                type="text"
                size="small"
                icon={<Edit size={12} />}
                onClick={() => handleEditVariable(variable)}
                className="!p-1"
              />
              <Popconfirm
                title={t('canvas.workflow.variables.deleteConfirm') || 'Delete this variable?'}
                onConfirm={() => handleDeleteVariable(variable.name)}
                okText={t('common.yes') || 'Yes'}
                cancelText={t('common.no') || 'No'}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<Delete size={12} />}
                  className="!p-1 text-red-500 hover:text-red-600"
                />
              </Popconfirm>
            </Space>
          )}
        </div>
      ),
    })),
    ...(variables.length === 0
      ? [
          {
            key: 'empty',
            label: (
              <div className="p-4 text-center text-gray-500">
                {t('canvas.workflow.variables.empty') || 'No variables defined'}
              </div>
            ),
            disabled: true,
          },
        ]
      : []),
  ];

  return (
    <>
      <Dropdown
        menu={{ items: dropdownItems }}
        trigger={['click']}
        placement="bottomRight"
        disabled={readonly}
      >
        <Button
          icon={<Settings size={16} />}
          className={className}
          loading={loading}
          title={t('canvas.workflow.variables.tooltip') || 'Workflow Variables'}
        />
      </Dropdown>

      <Modal
        title={
          editingVariable
            ? t('canvas.workflow.variables.editTitle') || 'Edit Variable'
            : t('canvas.workflow.variables.addTitle') || 'Add Variable'
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveVariable}
          initialValues={{ name: '', value: '', description: '' }}
        >
          <Form.Item
            name="name"
            label={t('canvas.workflow.variables.name') || 'Variable Name'}
            rules={[
              {
                required: true,
                message: t('canvas.workflow.variables.nameRequired') || 'Name is required',
              },
              {
                pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
                message:
                  t('canvas.workflow.variables.namePattern') || 'Invalid variable name format',
              },
            ]}
          >
            <Input
              placeholder={t('canvas.workflow.variables.namePlaceholder') || 'e.g., userName'}
            />
          </Form.Item>

          <Form.Item
            name="value"
            label={t('canvas.workflow.variables.value') || 'Variable Values (comma-separated)'}
            rules={[
              {
                required: true,
                message: t('canvas.workflow.variables.valueRequired') || 'Value is required',
              },
            ]}
          >
            <Input
              placeholder={
                t('canvas.workflow.variables.valuePlaceholder') || 'e.g., 张三, 李四, 王五'
              }
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('canvas.workflow.variables.description') || 'Description (Optional)'}
          >
            <Input.TextArea
              rows={2}
              placeholder={
                t('canvas.workflow.variables.descriptionPlaceholder') ||
                'e.g., User name for the workflow'
              }
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                }}
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingVariable ? t('common.save') || 'Save' : t('common.add') || 'Add'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
