import { WorkflowVariable } from '@refly/openapi-schema';

export interface TextSegment {
  type: 'text' | 'variable';
  content: string | string[]; // Support both single and multi-select values
  id?: string;
  placeholder?: string;
  variable?: WorkflowVariable;
  isDefaultValue?: boolean; // Whether this is a default value
  isModified?: boolean; // Whether the value has been modified by user
}

export interface MixedTextEditorProps {
  templateContent: string;
  variables?: WorkflowVariable[];
  onVariablesChange?: (variables: WorkflowVariable[]) => void;
  className?: string;
  disabled?: boolean;
  originalVariables?: WorkflowVariable[]; // Original variable values for state comparison
  onUploadingChange?: (uploading: boolean) => void; // Callback when any file is uploading
}

export interface VariableInputProps {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isDefaultValue?: boolean; // Whether this is a default value
  isModified?: boolean; // Whether the value has been modified by user
}
