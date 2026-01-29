/**
 * Shared utilities for file display components in Copilot
 */

/**
 * Image file extensions
 */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'];

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
