import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button, Modal, Form, Input, Checkbox, message } from 'antd';
import { Attachment, Close, List } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { cn, genVariableID } from '@refly/utils';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { MAX_VARIABLE_LENGTH } from '../node-preview/start';
import { StringTypeForm } from './string-type-form';
import { ResourceTypeForm } from './resource-type-form';
import { OptionTypeForm } from './option-type-form';
import { useFileUpload } from './hooks/use-file-upload';
import { useOptionsManagement } from './hooks/use-options-management';
import { useFormData } from './hooks/use-form-data';
import { getFileExtension } from './utils';
import type { CreateVariablesModalProps, VariableFormData } from './types';
import type { WorkflowVariable, VariableValue } from '@refly/openapi-schema';
import './index.scss';
import { BiText } from 'react-icons/bi';
import { RESOURCE_TYPE } from './constants';

export const CreateVariablesModal: React.FC<CreateVariablesModalProps> = React.memo(
  ({ visible, onCancel, defaultValue, variableType: initialVariableType }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm<VariableFormData>();
    const [variableType, setVariableType] = useState<string>(
      defaultValue?.variableType || initialVariableType || 'string',
    );
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const { workflow, canvasId } = useCanvasContext();
    const { workflowVariables, refetchWorkflowVariables } = workflow;
    const [isSaving, setIsSaving] = useState(false);

    const variableTypeOptions = useMemo(() => {
      return [
        {
          label: t('canvas.workflow.variables.variableTypeOptions.string'),
          value: 'string',
          icon: <BiText size={16} />,
        },
        {
          label: t('canvas.workflow.variables.variableTypeOptions.resource'),
          value: 'resource',
          icon: <Attachment size={16} />,
        },
        {
          label: t('canvas.workflow.variables.variableTypeOptions.option'),
          value: 'option',
          icon: <List size={16} />,
        },
      ];
    }, [t]);

    // Custom hooks
    const {
      uploading,
      handleFileUpload: uploadFile,
      handleRefreshFile: refreshFile,
    } = useFileUpload();

    const {
      options,
      editingIndex,
      currentOption,
      setOptionsValue,
      handleAddOption,
      handleRemoveOption,
      handleOptionChange,
      handleEditStart,
      handleEditSave,
      handleDragEnd,
      handleDragStart,
      setEditingIndex,
      setCurrentOption,
      resetOptions,
    } = useOptionsManagement(defaultValue?.options || []);

    const {
      stringFormData,
      resourceFormData,
      optionFormData,
      resetFormData,
      updateStringFormData,
      updateResourceFormData,
      updateOptionFormData,
    } = useFormData();

    // Initialize form data when modal becomes visible
    useEffect(() => {
      if (visible) {
        if (defaultValue) {
          setVariableType(defaultValue.variableType || 'string');

          // Initialize form data based on variable type
          if (defaultValue.variableType === 'string') {
            const newStringFormData = {
              ...stringFormData,
              name: defaultValue.name || '',
              value: defaultValue.value || [],
              description: defaultValue.description || '',
              required: defaultValue.required ?? true,
            };
            updateStringFormData(newStringFormData);
            form.setFieldsValue(newStringFormData);
          } else if (defaultValue.variableType === 'resource') {
            const newResourceFormData = {
              ...resourceFormData,
              name: defaultValue.name || '',
              value: defaultValue.value || [],
              description: defaultValue.description || '',
              required: defaultValue.required ?? true,
              resourceTypes: defaultValue.resourceTypes || RESOURCE_TYPE,
            };
            updateResourceFormData(newResourceFormData);
            form.setFieldsValue(newResourceFormData);

            // Set file list for resource type
            if (defaultValue.value?.length) {
              const files: UploadFile[] = defaultValue.value.map((value, index) => ({
                uid: `file-${index}`,
                name: value.resource?.name || '',
                status: 'done',
                url: value.resource?.storageKey || '', // Use storageKey from resource
              }));
              setFileList(files);
            }
          } else if (defaultValue.variableType === 'option') {
            const newOptionFormData = {
              ...optionFormData,
              name: defaultValue.name || '',
              value: defaultValue.value || [],
              description: defaultValue.description || '',
              required: defaultValue.required ?? true,
              isSingle: defaultValue.isSingle ?? true,
              options: defaultValue.options || [],
            };

            updateOptionFormData(newOptionFormData);
            form.setFieldsValue(newOptionFormData);
            setOptionsValue(defaultValue.options || []);
            setCurrentOption('');
          }
        }
      } else {
        setVariableType(initialVariableType || 'string');
        resetState();
      }
    }, [visible]);

    // Update form when variable type changes
    useEffect(() => {
      if (variableType === 'option') {
        form.setFieldsValue(optionFormData);
      }
      if (variableType === 'resource') {
        form.setFieldsValue(resourceFormData);
      }
      if (variableType === 'string') {
        form.setFieldsValue(stringFormData);
      }
    }, [form, variableType, optionFormData, resourceFormData, stringFormData]);

    // Handle form values change and store in corresponding form data
    const handleFormValuesChange = useCallback(
      (_changedValues: Partial<VariableFormData>) => {
        const currentFormValues = form.getFieldsValue();
        if (variableType === 'string') {
          updateStringFormData(currentFormValues);
        } else if (variableType === 'resource') {
          updateResourceFormData(currentFormValues);
        } else if (variableType === 'option') {
          updateOptionFormData(currentFormValues);
        }
      },
      [form, variableType, updateStringFormData, updateResourceFormData, updateOptionFormData],
    );

    const handleVariableTypeChange = useCallback(
      (type: string) => {
        // Store current form data before switching
        const currentFormValues = form.getFieldsValue();

        if (variableType === 'string') {
          updateStringFormData(currentFormValues);
        } else if (variableType === 'resource') {
          updateResourceFormData(currentFormValues);
        } else if (variableType === 'option') {
          updateOptionFormData(currentFormValues);
        }

        // Switch to new type
        setVariableType(type);

        // Reset editing states
        setEditingIndex(null);
      },
      [
        form,
        variableType,
        updateStringFormData,
        updateResourceFormData,
        updateOptionFormData,
        setEditingIndex,
      ],
    );

    // Update file list and sync with resource form data
    const handleFileListChange = useCallback(
      (newFileList: UploadFile[]) => {
        setFileList(newFileList);

        // Update resource form data with current file list
        if (variableType === 'resource') {
          const resourceValues: VariableValue[] = newFileList.map((file) => ({
            type: 'resource',
            resource: {
              name: file.name || '',
              storageKey: file.url || '', // Use url field to store storageKey
              fileType: getFileExtension(file.name) || 'file', // Store file extension
            },
          }));

          updateResourceFormData({
            value: resourceValues,
          });

          // Update form values to sync with the form
          form.setFieldValue('value', resourceValues);
        }
      },
      [variableType, form, updateResourceFormData],
    );

    const handleFileUpload = useCallback(
      async (file: File) => {
        const result = await uploadFile(file, fileList);
        if (result && typeof result === 'object' && 'storageKey' in result) {
          // Add file to list with storageKey
          const newFile: UploadFile = {
            uid: result.uid,
            name: file.name,
            status: 'done',
            url: result.storageKey, // Store storageKey in url field
          };

          const newFileList = [...fileList, newFile];
          handleFileListChange(newFileList);
          return false; // Prevent default upload behavior
        }
        return false;
      },
      [fileList, handleFileListChange, uploadFile],
    );

    const handleFileRemove = useCallback(
      (file: UploadFile) => {
        const newFileList = fileList.filter((f) => f.uid !== file.uid);
        handleFileListChange(newFileList);
      },
      [fileList, handleFileListChange],
    );

    const handleRefreshFile = useCallback(() => {
      refreshFile(fileList, handleFileListChange);
    }, [fileList, handleFileListChange, refreshFile]);

    const resetState = useCallback(() => {
      resetFormData();
      setFileList([]);
      resetOptions();
      form.resetFields();
    }, [resetFormData, resetOptions, form]);

    const saveVariable = useCallback(
      async (variable: WorkflowVariable) => {
        const existingIndex = workflowVariables.findIndex(
          (v) => v.variableId === variable.variableId,
        );

        let newWorkflowVariables: WorkflowVariable[];
        if (existingIndex !== -1) {
          newWorkflowVariables = [...workflowVariables];
          newWorkflowVariables[existingIndex] = variable;
        } else {
          newWorkflowVariables = [...workflowVariables, variable];
        }

        const { data } = await getClient().updateWorkflowVariables({
          body: {
            canvasId: canvasId,
            variables: newWorkflowVariables,
          },
        });

        if (data?.success) {
          message.success(
            t('canvas.workflow.variables.saveSuccess') || 'Variables saved successfully',
          );
        } else {
          message.error(t('canvas.workflow.variables.saveError') || 'Failed to save variables');
        }
        return data?.success;
      },
      [t, canvasId, workflowVariables],
    );

    const handleSubmit = useCallback(async () => {
      try {
        const values = await form.validateFields();

        // Check variable count limits before creating/updating
        const currentTypeCount =
          workflowVariables?.filter(
            (v) => v.variableType === variableType && v.variableId !== defaultValue?.variableId,
          ).length ?? 0;

        if (
          currentTypeCount >= MAX_VARIABLE_LENGTH[variableType as keyof typeof MAX_VARIABLE_LENGTH]
        ) {
          const typeName =
            t(`canvas.workflow.variables.variableTypeOptions.${variableType}`) || variableType;
          message.error(
            t('canvas.workflow.variables.typeLimitReached', { type: typeName }) ||
              `${typeName} type variables have reached the maximum limit and cannot be submitted.`,
          );
          return;
        }

        // Construct the value array based on variable type
        let finalValue: VariableValue[];
        if (variableType === 'string') {
          const textValue = values.value?.[0]?.text?.trim() ?? '';
          finalValue = textValue ? [{ type: 'text', text: textValue }] : [];
        } else if (variableType === 'resource') {
          // For resource type, construct value array from fileList
          finalValue = fileList.map((file) => ({
            type: 'resource',
            resource: {
              name: file.name || '',
              storageKey: file.url || '',
              fileType: getFileExtension(file.name) || 'file',
            },
          }));
        } else if (variableType === 'option' && options.length > 0 && options[0]) {
          finalValue = [
            {
              type: 'text',
              text: options[0] || '',
            },
          ];
        }

        const variable: WorkflowVariable = {
          variableId: defaultValue?.variableId || genVariableID(),
          name: values.name,
          value: finalValue,
          description: values.description,
          source: 'startNode',
          variableType: variableType as 'string' | 'option' | 'resource',
          required: values.required,
          ...(variableType === 'resource' && {
            resourceTypes: values.resourceTypes || RESOURCE_TYPE,
            isSingle: true,
            options: [],
          }),
          ...(variableType === 'option' && {
            isSingle: values.isSingle,
            options: options || [],
          }),
        };

        setIsSaving(true);
        const success = await saveVariable(variable);
        setIsSaving(false);
        if (success) {
          refetchWorkflowVariables();
          onCancel(false);
        }
      } catch (error) {
        console.error('Form validation failed:', error);
      }
    }, [
      form,
      variableType,
      fileList,
      onCancel,
      t,
      saveVariable,
      refetchWorkflowVariables,
      options,
      getFileExtension,
      workflowVariables,
      defaultValue,
    ]);

    const handleModalClose = useCallback(() => {
      onCancel(false);
    }, [onCancel]);

    const renderForm = useCallback(() => {
      switch (variableType) {
        case 'string':
          return <StringTypeForm />;
        case 'resource':
          return (
            <ResourceTypeForm
              fileList={fileList}
              uploading={uploading}
              onFileUpload={handleFileUpload}
              onFileRemove={handleFileRemove}
              onRefreshFile={handleRefreshFile}
              form={form}
            />
          );
        case 'option':
          return (
            <OptionTypeForm
              options={options}
              editingIndex={editingIndex}
              currentOption={currentOption}
              onEditingIndexChange={setEditingIndex}
              onCurrentOptionChange={setCurrentOption}
              onAddOption={handleAddOption}
              onRemoveOption={handleRemoveOption}
              onOptionChange={handleOptionChange}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onDragEnd={handleDragEnd}
              onDragStart={handleDragStart}
            />
          );
        default:
          return null;
      }
    }, [
      variableType,
      fileList,
      uploading,
      handleFileUpload,
      handleFileRemove,
      handleRefreshFile,
      options,
      editingIndex,
      currentOption,
      setEditingIndex,
      setCurrentOption,
      handleAddOption,
      handleRemoveOption,
      handleOptionChange,
      handleEditStart,
      handleEditSave,
      handleDragEnd,
      handleDragStart,
    ]);

    const handleNameBlur = useCallback(() => {
      const value = form.getFieldValue('name');
      if (value) {
        form.setFieldValue('name', value.trim());
      }
    }, [form]);

    return (
      <Modal
        className="create-variables-modal"
        centered
        open={visible}
        onCancel={handleModalClose}
        closable={false}
        title={null}
        footer={null}
        width={600}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-refly-text-0 text-lg font-semibold leading-6">
              {t(`canvas.workflow.variables.${defaultValue ? 'editTitle' : 'addTitle'}`) ||
                (defaultValue ? 'Edit Variable' : 'Add Variable')}
            </div>
            <Button type="text" icon={<Close size={24} />} onClick={handleModalClose} />
          </div>

          <div className="flex-grow min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-4">
              {variableTypeOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    'flex-1 px-2 py-1 text-sm leading-5 flex items-center justify-center gap-1 rounded-lg bg-refly-bg-control-z1 border-[1px] border-solid border-refly-Card-Border hover:!text-refly-primary-default hover:!border-refly-primary-default cursor-pointer',
                    variableType === option.value
                      ? 'text-refly-primary-default border-refly-primary-default font-semibold'
                      : '',
                  )}
                  onClick={() => handleVariableTypeChange(option.value)}
                >
                  {option.icon}
                  {option.label}
                </div>
              ))}
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onValuesChange={handleFormValuesChange}
              initialValues={{
                required: true,
                isSingle: true,
                value: [{ type: 'text', text: '' }],
                currentOption: '',
                resourceTypes: RESOURCE_TYPE,
              }}
            >
              <Form.Item
                label={t('canvas.workflow.variables.name') || 'Variable Name'}
                name="name"
                rules={[
                  {
                    required: true,
                    message:
                      t('canvas.workflow.variables.nameRequired') || 'Variable name is required',
                  },
                  {
                    validator: async (_, value) => {
                      if (!value) {
                        return Promise.resolve();
                      }

                      // Check for duplicate names in workflowVariables array
                      const trimmedName = value.trim();
                      const duplicateVariable = workflowVariables?.find(
                        (variable) =>
                          variable.name === trimmedName &&
                          variable.variableId !== defaultValue?.variableId,
                      );

                      if (duplicateVariable) {
                        throw new Error(
                          t('canvas.workflow.variables.duplicateName') ||
                            'Variable name already exists. Please choose a different name.',
                        );
                      }

                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input
                  placeholder={t('canvas.workflow.variables.inputPlaceholder') || 'Please enter'}
                  maxLength={50}
                  showCount
                  onBlur={handleNameBlur}
                />
              </Form.Item>
              {renderForm()}
              <Form.Item name="required" valuePropName="checked">
                <Checkbox className="required-checkbox">
                  <span className="text-refly-text-0 text-sm font-semibold">
                    {t('canvas.workflow.variables.required')}
                  </span>
                </Checkbox>
              </Form.Item>
            </Form>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button className="w-[80px]" onClick={handleModalClose}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              className="w-[80px]"
              type="primary"
              onClick={handleSubmit}
              loading={isSaving}
              disabled={isSaving}
            >
              {t('common.save') || 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  },
);

CreateVariablesModal.displayName = 'CreateVariablesModal';
