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
  // Markdown - Green
  md: { color: '#00A870', type: 'document' },
  // Spreadsheets - Green
  csv: { color: '#00A870', type: 'spreadsheet' },
  xls: { color: '#207245', type: 'spreadsheet' },
  xlsx: { color: '#207245', type: 'spreadsheet' },
  // Video - Red/Coral (matches Error color)
  mp4: { color: '#F04438', type: 'video' },
  mov: { color: '#F04438', type: 'video' },
  avi: { color: '#F04438', type: 'video' },
  mkv: { color: '#F04438', type: 'video' },
  webm: { color: '#F04438', type: 'video' },
  // Audio - Orange (matches Warning color)
  mp3: { color: '#F79009', type: 'audio' },
  wav: { color: '#F79009', type: 'audio' },
  // Code - Purple
  js: { color: '#7C3AED', type: 'code' },
  ts: { color: '#7C3AED', type: 'code' },
  tsx: { color: '#7C3AED', type: 'code' },
  jsx: { color: '#7C3AED', type: 'code' },
  py: { color: '#7C3AED', type: 'code' },
  json: { color: '#7C3AED', type: 'code' },
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
