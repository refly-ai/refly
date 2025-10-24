import type { FileCategoryInfo } from './types';
import {
  IMAGE_FILE_EXTENSIONS,
  AUDIO_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
  FILE_SIZE_LIMITS,
} from './constants';
import type { VariableResourceType } from '@refly/openapi-schema';

export const getFileExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDotIndex + 1).toLowerCase();
};

export const getFileType = (filename: string): VariableResourceType => {
  const extension = getFileExtension(filename);

  if (IMAGE_FILE_EXTENSIONS.includes(extension)) {
    return 'image';
  }
  if (AUDIO_FILE_EXTENSIONS.includes(extension)) {
    return 'audio';
  }
  if (VIDEO_FILE_EXTENSIONS.includes(extension)) {
    return 'video';
  }
  return 'document';
};

export const getFileCategoryAndLimit = (file: File): FileCategoryInfo => {
  const fileType = getFileType(file.name);

  // Image types
  if (fileType === 'image') {
    return { category: 'image', maxSize: FILE_SIZE_LIMITS.image * 1024 * 1024, fileType: fileType };
  }

  // Audio types
  if (fileType === 'audio') {
    return { category: 'audio', maxSize: FILE_SIZE_LIMITS.audio * 1024 * 1024, fileType: fileType };
  }

  // Video types
  if (fileType === 'video') {
    return { category: 'video', maxSize: FILE_SIZE_LIMITS.video * 1024 * 1024, fileType: fileType };
  }

  // default document type
  return {
    category: 'document',
    maxSize: FILE_SIZE_LIMITS.document * 1024 * 1024,
    fileType: fileType,
  };
};

export const ensureUniqueOptions = (options: string[]): string[] => {
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
};
