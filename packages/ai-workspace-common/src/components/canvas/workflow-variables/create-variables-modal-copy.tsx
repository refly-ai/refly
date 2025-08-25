import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WorkflowVariable, VariableValue } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Form, Input, Checkbox, Upload, message, Radio } from 'antd';
import { Close, Attachment, List, Add, Delete, Refresh } from 'refly-icons';
import { MdOutlineDragIndicator } from 'react-icons/md';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { BiText } from 'react-icons/bi';
import cn from 'classnames';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import './index.scss';
import { genVariableID } from '@refly/utils';
import {
  FileIcon,
  defaultStyles,
} from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { MAX_VARIABLE_LENGTH } from '../node-preview/start';

const MAX_OPTIONS = 20;
const DOCUMENT_FILE_EXTENSIONS = [
  'txt',
  'md',
  'mdx',
  'markdown',
  'pdf',
  'html',
  'xlsx',
  'xls',
  'doc',
  'docx',
  'csv',
  'eml',
  'msg',
  'pptx',
  'ppt',
  'xml',
  'epub',
];
const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const AUDIO_FILE_EXTENSIONS = ['mp3', 'm4a', 'wav', 'amr', 'mpga'];
const VIDEO_FILE_EXTENSIONS = ['mp4', 'mov', 'mpeg', 'webm'];
const ACCEPT_FILE_EXTENSIONS = [
  ...DOCUMENT_FILE_EXTENSIONS,
  ...IMAGE_FILE_EXTENSIONS,
  ...AUDIO_FILE_EXTENSIONS,
  ...VIDEO_FILE_EXTENSIONS,
];

interface CreateVariablesModalProps {
  variableType?: 'string' | 'option' | 'resource';
  defaultValue?: WorkflowVariable;
  visible: boolean;
  onCancel: (val: boolean) => void;
  onSave?: (variable: WorkflowVariable) => void;
}

interface VariableFormData {
  name: string;
  value: VariableValue[];
  description?: string;
  required: boolean;
  isSingle?: boolean;
  options?: string[];
  currentOption?: string;
}

const initialData: VariableFormData = {
  name: '',
  value: [],
  description: '',
  required: true,
  isSingle: true,
  options: [],
};

const defaultStringData: VariableFormData = {
  ...initialData,
  value: [{ type: 'text', text: '' }],
};

const defaultResourceData: VariableFormData = {
  ...initialData,
  value: [{ type: 'resource', resource: { name: '', storageKey: '', fileType: 'image' } }],
};

const defaultOptionData: VariableFormData = {
  ...initialData,
  value: [{ type: 'text', text: '' }],
};

export const CreateVariablesModal = ({
  visible,
  onCancel,
  defaultValue,
  variableType: initialVariableType,
}: CreateVariablesModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<VariableFormData>();
  const [variableType, setVariableType] = useState<string>(
    defaultValue?.variableType || initialVariableType || 'string',
  );
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const { workflow, canvasId } = useCanvasContext();
  const { workflowVariables, refetchWorkflowVariables } = workflow;
  const [isSaving, setIsSaving] = useState(false);

  const [stringFormData, setStringFormData] = useState<VariableFormData>({
    ...defaultStringData,
  });

  const [resourceFormData, setResourceFormData] = useState<VariableFormData>({
    ...defaultResourceData,
  });

  const [optionFormData, setOptionFormData] = useState<VariableFormData>({
    ...defaultOptionData,
  });
  const [options, setOptions] = useState<string[]>(defaultValue?.options || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentOption, setCurrentOption] = useState<string>('');

  // Helper function to get file extension
  const getFileExtension = useCallback((filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
      return ''; // No extension or dot at the end
    }
    return filename.slice(lastDotIndex + 1).toLowerCase();
  }, []);

  // Helper function to get file category and size limit
  const getFileCategoryAndLimit = useCallback(
    (file: File) => {
      const extension = getFileExtension(file.name);

      // Document types
      if (DOCUMENT_FILE_EXTENSIONS.includes(extension)) {
        return { category: 'document', maxSize: 20 * 1024 * 1024, fileType: extension };
      }

      // Image types
      if (IMAGE_FILE_EXTENSIONS.includes(extension)) {
        return { category: 'image', maxSize: 10 * 1024 * 1024, fileType: extension };
      }

      // Audio types
      if (AUDIO_FILE_EXTENSIONS.includes(extension)) {
        return { category: 'audio', maxSize: 50 * 1024 * 1024, fileType: extension };
      }

      // Video types
      if (VIDEO_FILE_EXTENSIONS.includes(extension)) {
        return { category: 'video', maxSize: 100 * 1024 * 1024, fileType: extension };
      }

      // Unknown type
      return { category: 'unknown', maxSize: 100 * 1024 * 1024, fileType: extension };
    },
    [getFileExtension],
  );

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

  useEffect(() => {
    if (visible) {
      if (defaultValue) {
        setVariableType(defaultValue.variableType || 'string');

        // Initialize form data based on variable type
        if (defaultValue.variableType === 'string') {
          const newStringFormData = {
            ...defaultStringData,
            name: defaultValue.name || '',
            value: defaultValue.value || [],
            description: defaultValue.description || '',
            required: defaultValue.required ?? true,
          };
          setStringFormData(newStringFormData);
          form.setFieldsValue(newStringFormData);
        } else if (defaultValue.variableType === 'resource') {
          const newResourceFormData = {
            ...defaultResourceData,
            name: defaultValue.name || '',
            value: defaultValue.value || [],
            description: defaultValue.description || '',
            required: defaultValue.required ?? true,
          };
          setResourceFormData(newResourceFormData);
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
            ...defaultOptionData,
            name: defaultValue.name || '',
            value: defaultValue.value || [],
            description: defaultValue.description || '',
            required: defaultValue.required ?? true,
            isSingle: defaultValue.isSingle ?? true,
            options: defaultValue.options || [],
          };

          setOptionFormData(newOptionFormData);
          form.setFieldsValue(newOptionFormData);
          setOptionsValue(defaultValue.options || []);
          setCurrentOption('');
        }
      }
    } else {
      resetState();
    }
  }, [visible]);

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
    (changedValues: Partial<VariableFormData>) => {
      console.log('Form values changed:', { variableType, changedValues });

      // Store form data based on current variable type
      const currentFormValues = form.getFieldsValue();
      console.log('Form values changed:', { variableType, changedValues, currentFormValues });

      if (variableType === 'string') {
        setStringFormData((prev) => {
          const newData = {
            ...prev,
            ...currentFormValues,
          };
          console.log('Updated stringFormData:', newData);
          return newData;
        });
      } else if (variableType === 'resource') {
        setResourceFormData((prev) => {
          const newData = { ...prev, ...currentFormValues };
          console.log('Updated resourceFormData:', newData);
          return newData;
        });
      } else if (variableType === 'option') {
        setOptionFormData((prev) => {
          const newData = { ...prev, ...currentFormValues };
          console.log('Updated optionFormData:', newData);
          return newData;
        });
      }
    },
    [form, variableType],
  );

  const handleVariableTypeChange = (type: string) => {
    // Store current form data before switching
    const currentFormValues = form.getFieldsValue();
    console.log('Switching from', variableType, 'to', type, 'with values:', currentFormValues);

    if (variableType === 'string') {
      setStringFormData((prev) => {
        const newData = { ...prev, ...currentFormValues };
        console.log('Saving stringFormData:', newData);
        return newData;
      });
    } else if (variableType === 'resource') {
      setResourceFormData((prev) => {
        const newData = { ...prev, ...currentFormValues };
        console.log('Saving resourceFormData:', newData);
        return newData;
      });
    } else if (variableType === 'option') {
      setOptionFormData((prev) => {
        const newData = { ...prev, ...currentFormValues };
        console.log('Saving optionFormData:', newData);
        return newData;
      });
    }

    // Switch to new type
    setVariableType(type);

    // Reset editing states
    setEditingIndex(null);
  };

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

        setResourceFormData((prev) => ({
          ...prev,
          value: resourceValues,
        }));

        // Update form values to sync with the form
        form.setFieldValue('value', resourceValues);
      }
    },
    [variableType, form, getFileExtension],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        // Check file count limit
        const maxFileCount = 1; // Maximum 10 files
        if (fileList.length >= maxFileCount) {
          message.error(t('common.tooManyFiles') || `Maximum ${maxFileCount} files allowed`);
          return false;
        }

        // Check for duplicate file names
        const existingFileNames = fileList.map((f) => f.name);
        if (existingFileNames.includes(file.name)) {
          message.error(t('common.duplicateFileName') || 'File with this name already exists');
          return false;
        }

        // File validation
        const { maxSize, category, fileType } = getFileCategoryAndLimit(file);

        // Check if file type is supported
        if (category === 'unknown') {
          message.error(t('common.unsupportedFileType') || `Unsupported file type: .${fileType}`);
          return false;
        }

        // Additional MIME type validation for better security
        const mimeTypeValidation = {
          document: [
            'text/',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/xml',
            'application/epub+zip',
            'message/rfc822',
            'application/vnd.ms-outlook',
          ],
          image: ['image/'],
          audio: ['audio/'],
          video: ['video/'],
        };

        const allowedMimeTypes =
          mimeTypeValidation[category as keyof typeof mimeTypeValidation] || [];
        const isValidMimeType = allowedMimeTypes.some((type) => file.type.startsWith(type));

        if (!isValidMimeType) {
          message.error(
            t('common.unsupportedFileType') ||
              `File MIME type not supported for ${category}: ${file.type}`,
          );
          return false;
        }

        // Check file size limit
        if (maxSize > 0 && file.size > maxSize) {
          const maxSizeMB = maxSize / (1024 * 1024);
          message.error(
            t('common.fileTooLarge') || `${category} file size exceeds ${maxSizeMB}MB limit`,
          );
          return false;
        }

        setUploading(true);

        // Generate temporary UID for the file
        const tempUid = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Call uploadFile function to get storageKey
        const data = await uploadFile(file, tempUid);

        if (!data?.storageKey) {
          message.error(t('common.uploadFailed') || 'Upload failed');
          return false;
        }

        // Add file to list with storageKey
        const newFile: UploadFile = {
          uid: tempUid,
          name: file.name,
          status: 'done',
          url: data.storageKey, // Store storageKey in url field
        };

        const newFileList = [...fileList, newFile];
        handleFileListChange(newFileList);
        message.success(t('common.uploadSuccess') || 'Upload successful');
        return false; // Prevent default upload behavior
      } catch (error) {
        console.error('Upload error:', error);
        message.error(t('common.uploadFailed') || 'Upload failed');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [t, fileList, handleFileListChange, getFileCategoryAndLimit],
  );

  // Add uploadFile function to handle file upload and get storageKey
  const uploadFile = useCallback(async (file: File, uid: string) => {
    try {
      const { data, error } = await getClient().upload({
        body: { file },
      });

      if (error) {
        const errorMessage =
          typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
            : 'Unknown error';
        throw new Error(`Upload error: ${errorMessage}`);
      }

      if (!data?.data?.storageKey) {
        throw new Error('Upload response missing storageKey');
      }

      return {
        storageKey: data.data.storageKey,
        url: data.data.url || '',
        uid,
      };
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof Error) {
        throw new Error(`File upload failed: ${error.message}`);
      } else {
        throw new Error('File upload failed: Unknown error');
      }
    }
  }, []);

  const handleRefreshFile = useCallback(() => {
    // Create a hidden file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = ACCEPT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
    fileInput.multiple = false;
    fileInput.style.display = 'none';

    // Add event listener for file selection
    fileInput.addEventListener('change', async (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;

      if (files && files.length > 0) {
        const file = files[0];

        try {
          // Validate and upload the new file
          const { maxSize, category, fileType } = getFileCategoryAndLimit(file);

          // Check if file type is supported
          if (category === 'unknown') {
            message.error(t('common.unsupportedFileType') || `Unsupported file type: .${fileType}`);
            return;
          }

          // Check file size limit
          if (maxSize > 0 && file.size > maxSize) {
            const maxSizeMB = maxSize / (1024 * 1024);
            message.error(
              t('common.fileTooLarge') || `${category} file size exceeds ${maxSizeMB}MB limit`,
            );
            return;
          }

          setUploading(true);

          // Generate new UID for the file
          const tempUid = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Upload the new file
          const data = await uploadFile(file, tempUid);

          if (!data?.storageKey) {
            message.error(t('common.uploadFailed') || 'Upload failed');
            return;
          }

          // Replace the existing file with the new one
          const newFile: UploadFile = {
            uid: tempUid,
            name: file.name,
            status: 'done',
            url: data.storageKey,
          };

          // Replace the file list with the new file
          const newFileList = [newFile];
          handleFileListChange(newFileList);

          message.success(t('common.uploadSuccess') || 'File refreshed successfully');
        } catch (error) {
          console.error('File refresh error:', error);
          message.error(t('common.uploadFailed') || 'File refresh failed');
        } finally {
          setUploading(false);
        }
      }

      // Clean up the file input
      document.body.removeChild(fileInput);
    });

    // Add to DOM and trigger click
    document.body.appendChild(fileInput);
    fileInput.click();
  }, [getFileCategoryAndLimit, uploadFile, handleFileListChange, t]);

  const handleFileRemove = useCallback(
    (file: UploadFile) => {
      const newFileList = fileList.filter((f) => f.uid !== file.uid);
      handleFileListChange(newFileList);
    },
    [fileList, handleFileListChange],
  );

  // Helper function to ensure options uniqueness
  const ensureUniqueOptions = useCallback((options: string[]) => {
    const validOptions = options.filter((option) => option && option.trim().length > 0);
    const uniqueOptions: string[] = [];
    const seen = new Set<string>();

    for (const option of validOptions) {
      if (!seen.has(option)) {
        seen.add(option);
        uniqueOptions.push(option);
      }
    }

    return uniqueOptions;
  }, []);

  const setOptionsValue = useCallback(
    (options: string[]) => {
      // Ensure uniqueness when setting options
      const uniqueOptions = ensureUniqueOptions(options);
      setOptions(uniqueOptions);

      if (variableType === 'option') {
        setOptionFormData((prev) => ({
          ...prev,
          options: uniqueOptions,
          value: uniqueOptions[0] ? [{ type: 'text', text: uniqueOptions[0] }] : [],
        }));
      }
    },
    [variableType, ensureUniqueOptions],
  );

  // Function to add new options without filtering (for adding empty options)
  const addNewOption = useCallback(
    (newOptions: string[]) => {
      setOptions(newOptions);

      if (variableType === 'option') {
        setOptionFormData((prev) => ({
          ...prev,
          options: newOptions,
          value: newOptions[0] ? [{ type: 'text', text: newOptions[0] }] : [],
        }));
      }
    },
    [variableType],
  );

  const resetState = useCallback(() => {
    setStringFormData({
      ...defaultStringData,
    });
    setResourceFormData({
      ...defaultResourceData,
    });
    setFileList([]);

    setOptionFormData({
      ...defaultOptionData,
    });
    setOptionsValue([]);
    setEditingIndex(null);
    setCurrentOption('');
    form.resetFields();
  }, [
    form,
    setStringFormData,
    setResourceFormData,
    setFileList,
    setOptionFormData,
    setOptionsValue,
    setEditingIndex,
    setCurrentOption,
  ]);

  // Option management handlers with form data sync
  const handleAddOption = useCallback(() => {
    if (options.length < MAX_OPTIONS) {
      // Add empty option directly without filtering
      const newOptions = [...options, ''];
      addNewOption(newOptions);

      // Auto focus the new input field
      const newIndex = newOptions.length - 1;
      setEditingIndex(newIndex);
      setCurrentOption('');
      form.setFieldValue('currentOption', '');
    } else {
      message.warning(
        t('canvas.workflow.variables.maxOptionsReached') ||
          `Maximum ${MAX_OPTIONS} options allowed`,
      );
    }
  }, [options, addNewOption, form, t]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      const newOptions = options.filter((_, i) => i !== index);
      setOptionsValue(newOptions);
    },
    [options, setOptionsValue],
  );

  const handleOptionChange = useCallback(
    (index: number, value: string) => {
      const newOptions = [...options];
      newOptions[index] = value;

      // During editing, allow empty values and don't filter
      // Only check for duplicates among non-empty values
      if (value.trim()) {
        // Check for duplicates only if the value is not empty
        const duplicateIndex = newOptions.findIndex(
          (option, i) => i !== index && option.trim() && option === value,
        );

        if (duplicateIndex !== -1) {
          message.error(
            t('canvas.workflow.variables.duplicateOption') ||
              'Duplicate option value is not allowed',
          );
          return; // Don't update if duplicate found
        }
      }

      // Update options without filtering (allow empty values during editing)
      addNewOption(newOptions);
    },
    [options, addNewOption, t],
  );

  const handleEditStart = useCallback(
    (index: number) => {
      setEditingIndex(index);
      const value = options?.[index] ?? '';
      setCurrentOption(value);
      form.setFieldValue('currentOption', value);
    },
    [setEditingIndex, options, form],
  );

  const handleEditSave = useCallback(
    (value: string, index: number) => {
      const trimmedValue = value.trim();

      if (trimmedValue) {
        // When saving, use setOptionsValue to ensure uniqueness and filter empty values
        const newOptions = [...options];
        newOptions[index] = trimmedValue;
        setOptionsValue(newOptions);
      } else {
        handleRemoveOption(index);
      }
    },
    [options, setOptionsValue, handleRemoveOption],
  );

  // Handle drag and drop for reordering options
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      if (sourceIndex === destinationIndex) {
        return;
      }

      const newOptions = Array.from(options);
      const [removed] = newOptions.splice(sourceIndex, 1);
      newOptions.splice(destinationIndex, 0, removed);

      // After reordering, use setOptionsValue to ensure uniqueness and filter empty values
      setOptionsValue(newOptions);
    },
    [options, setOptionsValue],
  );

  const handleDragStart = useCallback(() => {
    setEditingIndex(null);
  }, [setEditingIndex]);

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
        const textValue = values.value?.[0]?.text ?? '';
        finalValue = textValue ? [{ type: 'text', text: textValue }] : [];
      } else if (variableType === 'resource') {
        // For resource type, construct value array from fileList
        finalValue = fileList.map((file) => ({
          type: 'resource',
          resource: {
            name: file.name || '',
            storageKey: file.url || '', // url field contains storageKey
            fileType: getFileExtension(file.name) || 'file', // Store file extension
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
          isSingle: values.isSingle,
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
    setIsSaving,
  ]);

  const handleModalClose = useCallback(() => {
    onCancel(false);
  }, [onCancel]);

  const renderStringTypeForm = () => (
    <Form.Item
      label={t('canvas.workflow.variables.value') || 'Variable Value'}
      name={['value', 0, 'text']}
    >
      <Input
        placeholder={t('canvas.workflow.variables.inputPlaceholder') || 'Please enter'}
        maxLength={200}
        showCount
      />
    </Form.Item>
  );

  const renderResourceTypeForm = () => (
    <Form.Item label={t('canvas.workflow.variables.value') || 'Variable Value'}>
      <Upload
        className="file-upload-container"
        fileList={fileList}
        beforeUpload={handleFileUpload}
        onRemove={handleFileRemove}
        onChange={(info) => {
          // Handle file status changes
          if (info.file.status === 'uploading') {
            setUploading(true);
          } else if (info.file.status === 'done') {
            setUploading(false);
          } else if (info.file.status === 'error') {
            setUploading(false);
            message.error(`${info.file.name} upload failed`);
          }
        }}
        multiple={false}
        accept={ACCEPT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
        listType="text"
        disabled={uploading}
        maxCount={1}
        itemRender={(_originNode, file) => (
          <Spin className="w-full" spinning={uploading}>
            <div className="w-full h-9 flex items-center justify-between gap-2 box-border px-2 bg-refly-bg-control-z0 rounded-lg hover:bg-refly-tertiary-hover">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileIcon
                  extension={getFileExtension(file.name || '')}
                  width={20}
                  height={20}
                  type="icon"
                  {...defaultStyles[getFileExtension(file.name || '')]}
                />
                <div className="min-w-0 flex-1 text-sm text-refly-text-0 leading-5 truncate">
                  {file.name}
                </div>
              </div>

              <div className="fl">
                <Button
                  size="small"
                  type="text"
                  icon={<Refresh size={16} color="var(--refly-text-1)" />}
                  onClick={handleRefreshFile}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<Delete size={16} color="var(--refly-text-1)" />}
                  onClick={() => handleFileRemove(file)}
                />
              </div>
            </div>
          </Spin>
        )}
      >
        {fileList.length === 0 && (
          <Button
            className="w-full bg-refly-bg-control-z0 border-none"
            type="default"
            disabled={uploading}
            loading={uploading}
          >
            {t('canvas.workflow.variables.upload') || 'Upload Files'}
          </Button>
        )}
      </Upload>
    </Form.Item>
  );

  const renderOptionTypeForm = () => {
    return (
      <>
        <Form.Item
          label={t('canvas.workflow.variables.selectMode') || 'Selection Mode'}
          name="isSingle"
        >
          <Radio.Group>
            <Radio value={true}>
              {t('canvas.workflow.variables.singleSelect') || 'Single Select'}
            </Radio>
            <Radio value={false}>
              {t('canvas.workflow.variables.multipleSelect') || 'Multiple Select'}
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label={t('canvas.workflow.variables.options') || 'Options'}
          name="currentOption"
          rules={[
            {
              validator: async (_, _value) => {
                if (!options?.length || options.length < 1) {
                  throw new Error(
                    t('canvas.workflow.variables.optionsRequired') ||
                      'At least one option is required',
                  );
                }

                // Filter out empty options
                const validOptions = options.filter((option) => option && option.trim().length > 0);
                if (validOptions.length < 1) {
                  throw new Error(
                    t('canvas.workflow.variables.optionsRequired') ||
                      'At least one valid option is required',
                  );
                }

                // Check for duplicate values (case-insensitive)
                const uniqueOptions = new Set(validOptions.map((option) => option.toLowerCase()));
                if (uniqueOptions.size !== validOptions.length) {
                  throw new Error(
                    t('canvas.workflow.variables.duplicateOption') ||
                      'Duplicate option value is not allowed',
                  );
                }

                return Promise.resolve();
              },
            },
          ]}
        >
          <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            <Droppable droppableId="options-list">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2 max-h-[200px] overflow-y-auto"
                >
                  {options.map((option, index) => (
                    <Draggable
                      key={`option-${index}`}
                      draggableId={`option-${index}`}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center"
                        >
                          {/* Hidden drag handle for editing state to satisfy react-beautiful-dnd */}
                          {editingIndex === index && (
                            <div
                              {...provided.dragHandleProps}
                              className="invisible w-0 h-0"
                              aria-hidden="true"
                            />
                          )}

                          {editingIndex === index ? (
                            <Input
                              value={currentOption}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCurrentOption(val);
                                handleOptionChange(index, val);
                                form.setFieldValue('currentOption', val ?? '');
                              }}
                              onBlur={() => {
                                handleEditSave(currentOption ?? '', index);
                                setEditingIndex(null);
                              }}
                              autoFocus
                              className="flex-1"
                              data-option-index={index}
                              maxLength={200}
                              showCount
                            />
                          ) : (
                            <div
                              className={cn(
                                'group w-full h-8 p-2 flex items-center gap-2 box-border border-[1px] border-solid border-refly-Card-Border rounded-lg hover:bg-refly-tertiary-hover cursor-pointer',
                                {
                                  'shadow-lg': snapshot.isDragging,
                                },
                              )}
                              onClick={() => handleEditStart(index)}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="flex items-center justify-center"
                              >
                                <MdOutlineDragIndicator
                                  className="text-refly-text-3 cursor-move"
                                  size={16}
                                />
                              </div>
                              <div
                                className={cn('flex-1 text-sm leading-5 truncate', {
                                  'text-refly-text-3': !option,
                                })}
                              >
                                {option ||
                                  t('canvas.workflow.variables.clickToEdit') ||
                                  'Click to edit'}
                              </div>
                              <Button
                                className="hidden group-hover:block"
                                type="text"
                                size="small"
                                icon={<Delete size={16} color="var(--refly-text-1)" />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleRemoveOption(index);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {options.length < MAX_OPTIONS && (
            <Button
              type="default"
              onClick={handleAddOption}
              className="w-full border-none bg-refly-bg-control-z0 mt-2"
              icon={<Add size={16} />}
              disabled={editingIndex && !currentOption}
            >
              {t('canvas.workflow.variables.addOption') || 'Add Option'}
            </Button>
          )}
        </Form.Item>
      </>
    );
  };

  const renderForm = () => {
    switch (variableType) {
      case 'string':
        return renderStringTypeForm();
      case 'resource':
        return renderResourceTypeForm();
      case 'option':
        return renderOptionTypeForm();
      default:
        return null;
    }
  };

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
          <div className="text-xs text-refly-text-0 mb-2 font-semibold">
            {t('canvas.workflow.variables.variableType') || 'Variable Type'}
          </div>

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
};
