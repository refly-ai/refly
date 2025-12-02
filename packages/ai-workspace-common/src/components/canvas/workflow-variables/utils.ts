import type { FileCategoryInfo } from './types';
import {
  IMAGE_FILE_EXTENSIONS,
  AUDIO_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
  FILE_SIZE_LIMITS,
  CODE_FILE_EXTENSIONS,
} from './constants';
import type { VariableResourceType } from '@refly/openapi-schema';

export const getFileExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDotIndex + 1).toLowerCase();
};

/**
 * Get file type from filename and optional MIME type.
 * Priority:
 * 1. If extension is a known code file, always return 'document'
 * 2. Check extension against known lists (image, audio, video)
 * 3. Fall back to MIME type if provided
 * 4. Default to 'document'
 *
 * @param filename - The filename to check
 * @param mimeType - Optional MIME type from the File object
 * @returns The resource type (document, image, audio, or video)
 */
export const getFileType = (filename: string, mimeType?: string): VariableResourceType => {
  const extension = getFileExtension(filename);

  // Priority 1: Code and text files should always be documents
  // This prevents .ts files from being detected as video files
  if (CODE_FILE_EXTENSIONS.includes(extension)) {
    return 'document';
  }

  // Priority 2: Check extension against known lists
  if (IMAGE_FILE_EXTENSIONS.includes(extension)) {
    return 'image';
  }
  if (AUDIO_FILE_EXTENSIONS.includes(extension)) {
    return 'audio';
  }
  if (VIDEO_FILE_EXTENSIONS.includes(extension)) {
    return 'video';
  }

  // Priority 3: If no extension match and MIME type is provided, use MIME type
  if (mimeType) {
    const mimeTypePrefix = mimeType.split('/')[0].toLowerCase();
    if (mimeTypePrefix === 'image') {
      return 'image';
    }
    if (mimeTypePrefix === 'audio') {
      return 'audio';
    }
    if (mimeTypePrefix === 'video') {
      return 'video';
    }
    // Any text/* or application/* MIME types should be documents
    if (mimeTypePrefix === 'text' || mimeTypePrefix === 'application') {
      return 'document';
    }
  }

  // Priority 4: Default to document for unknown types
  return 'document';
};

export const getFileCategoryAndLimit = (file: File): FileCategoryInfo => {
  const fileType = getFileType(file.name, file.type);

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
