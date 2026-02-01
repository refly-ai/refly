export { CreateVariablesModal } from './create-variables-modal';

// Export types
export type {
  CreateVariablesModalProps,
  VariableFormData,
  VariableTypeOption,
  FileCategoryInfo,
} from './types';

// Export constants
export {
  MAX_OPTIONS,
  DOCUMENT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
  AUDIO_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
  FILE_SIZE_LIMITS,
} from './constants';

// Export utilities
export {
  getFileExtension,
  getFileCategoryAndLimit,
  ensureUniqueOptions,
} from './utils';

// Export hooks
export { useFileUpload } from './hooks/use-file-upload';
export { useOptionsManagement } from './hooks/use-options-management';
export { useFormData } from './hooks/use-form-data';
