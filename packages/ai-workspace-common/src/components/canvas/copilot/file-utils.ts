/**
 * Shared utilities for file display components in Copilot
 */

// File type color and icon configurations matching design system
export const FILE_TYPE_CONFIG: Record<string, { color: string; type?: string }> = {
  // Documents - Blue
  txt: { color: '#0062D6', type: 'document' },
  doc: { color: '#2C5898', type: 'document' },
  docx: { color: '#2C5898', type: 'document' },
  pdf: { color: '#D93831', type: 'acrobat' },
  // Markdown - Cyan (uses code icon in design)
  md: { color: '#18C0E6', type: 'code' },
  // Spreadsheets - Green
  csv: { color: '#0E9F77', type: 'spreadsheet' },
  xls: { color: '#0E9F77', type: 'spreadsheet' },
  xlsx: { color: '#0E9F77', type: 'spreadsheet' },
  // Video - Red (uses audio/spectrum icon in design)
  mp4: { color: '#F93920', type: 'audio' },
  mov: { color: '#F93920', type: 'audio' },
  avi: { color: '#F93920', type: 'audio' },
  mkv: { color: '#F93920', type: 'audio' },
  webm: { color: '#F93920', type: 'audio' },
  // Audio - Orange
  mp3: { color: '#F79009', type: 'audio' },
  wav: { color: '#F79009', type: 'audio' },
  // Code - Cyan
  js: { color: '#18C0E6', type: 'code' },
  ts: { color: '#18C0E6', type: 'code' },
  tsx: { color: '#18C0E6', type: 'code' },
  jsx: { color: '#18C0E6', type: 'code' },
  py: { color: '#18C0E6', type: 'code' },
  json: { color: '#18C0E6', type: 'code' },
  // Default
  default: { color: '#0062D6', type: 'document' },
};

/**
 * Get file type config based on file extension
 */
export const getFileTypeConfig = (ext: string) => {
  return FILE_TYPE_CONFIG[ext.toLowerCase()] || FILE_TYPE_CONFIG.default;
};

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
