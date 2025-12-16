import type { WorkflowVariable, VariableValue, VariableResourceType } from '@refly/openapi-schema';

export interface CreateVariablesModalProps {
  variableType?: 'string' | 'option' | 'resource';
  disableChangeVariableType?: boolean;
  isFromResource?: boolean;
  defaultValue?: WorkflowVariable;
  visible: boolean;
  onCancel: (val: boolean) => void;
  onSave?: (variable: WorkflowVariable) => void;
  mode: 'create' | 'edit';
  onViewCreatedVariable?: (variable: WorkflowVariable) => void;
  showFileUploadError?: boolean;
}

export interface VariableFormData {
  name: string;
  value: VariableValue[];
  selectedValue?: string | string[];
  description?: string;
  required: boolean;
  isSingle?: boolean;
  options?: string[];
  currentOption?: string;
  resourceTypes?: VariableResourceType[];
}

export interface VariableTypeOption {
  label: string;
  value: string;
  icon: React.ReactNode;
}

export interface FileCategoryInfo {
  category: 'document' | 'image' | 'audio' | 'video' | 'unknown';
  maxSize: number;
  fileType: string;
}
