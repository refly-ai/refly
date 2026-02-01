/**
 * File type utilities for CLI
 * Independent implementation to avoid external dependencies
 */

// File category type (matches server-side DriveFileCategory)
export type FileCategory = 'document' | 'image' | 'video' | 'audio';

// Code and text file extensions - these should always be treated as documents
const CODE_FILE_EXTENSIONS = [
  // TypeScript/JavaScript
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  // Web
  'css',
  'scss',
  'sass',
  'less',
  // Other programming languages
  'py',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'sh',
  'bash',
  'zsh',
  // Config files
  'json',
  'yaml',
  'yml',
  'toml',
  'xml',
  'ini',
  'env',
  // Text and document files
  'txt',
  'md',
  'markdown',
];

// Media file extensions for category detection
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'mpga'];

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Get file category by filename extension with MIME type fallback.
 * Priority: Code files → Extension → MIME type → default 'document'
 *
 * This handles edge cases like .ts files being incorrectly detected as video/mp2t.
 *
 * @param filename - The filename (with extension)
 * @param mimeType - Optional MIME type as fallback
 * @returns The file category
 */
export function getFileCategoryByName(filename: string, mimeType?: string): FileCategory {
  const extension = getFileExtension(filename);

  // Priority 1: Code files → document (prevents .ts being detected as video)
  if (CODE_FILE_EXTENSIONS.includes(extension)) {
    return 'document';
  }

  // Priority 2: Check by extension
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (AUDIO_EXTENSIONS.includes(extension)) return 'audio';

  // Priority 3: MIME type fallback (use prefix matching)
  if (mimeType) {
    const mimeTypePrefix = mimeType.split('/')[0].toLowerCase();
    if (mimeTypePrefix === 'image') return 'image';
    if (mimeTypePrefix === 'audio') return 'audio';
    if (mimeTypePrefix === 'video') return 'video';
  }

  // Default to document
  return 'document';
}

/**
 * Get file category from MIME type only
 * @param mimeType - The MIME type
 * @returns The file category
 */
export function getFileCategoryByMimeType(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'document';
  if (mimeType.startsWith('text/')) return 'document';
  return 'document';
}
