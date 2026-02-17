/**
 * Shared utilities for file display components in Copilot
 */

/**
 * Image file extensions
 */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'];

/**
 * Audio file extensions
 */
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'wma'];

/**
 * Video file extensions
 */
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v'];

/**
 * Document extensions / MIME prefixes that are definitely not images.
 * Used to avoid showing image thumbnail for known document types when type is ambiguous.
 */
const DOCUMENT_EXTENSIONS = new Set([
  'csv',
  'xls',
  'xlsx',
  'txt',
  'md',
  'markdown',
  'pdf',
  'html',
  'docx',
  'epub',
  'json',
  'yaml',
  'yml',
  'xml',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'java',
  'c',
  'cpp',
]);
const DOCUMENT_MIME_PREFIXES = ['text/', 'application/pdf', 'application/vnd.', 'application/json'];

/**
 * Check if file is an image type based on extension or MIME type
 */
export const isImageFile = (extOrMimeType?: string, ext?: string): boolean => {
  // Check MIME type first
  if (extOrMimeType?.startsWith('image/')) return true;
  // Check extension
  const extension = ext ?? extOrMimeType;
  if (extension) {
    return IMAGE_EXTENSIONS.includes(extension.toLowerCase());
  }
  return false;
};

/**
 * Check if file is an audio or video type based on extension or MIME type
 */
export const isAudioVideoFile = (mimeType?: string, extension?: string): boolean => {
  // Check MIME type first
  if (mimeType) {
    const lower = mimeType.toLowerCase();
    if (lower.startsWith('audio/') || lower.startsWith('video/')) return true;
  }
  // Check extension
  if (extension) {
    const ext = extension.toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext) || VIDEO_EXTENSIONS.includes(ext);
  }
  return false;
};

/**
 * Check if file is a known document type (not image) by extension or MIME type.
 * Used when we have a content URL but no clear image signal — if it's not a document, we try image thumbnail.
 */
export const isDocumentFile = (mimeType?: string, extension?: string): boolean => {
  if (mimeType) {
    const lower = mimeType.toLowerCase();
    if (lower.startsWith('image/')) return false;
    if (DOCUMENT_MIME_PREFIXES.some((p) => lower.startsWith(p))) return true;
  }
  if (extension) {
    return DOCUMENT_EXTENSIONS.has(extension.toLowerCase());
  }
  return false;
};

/**
 * Format file size for display (e.g., "1.5MB", "256KB")
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

/**
 * Get file extension from filename
 */
export const getFileExtension = (filename?: string): string => {
  return filename?.split('.').pop()?.toLowerCase() || '';
};
