import { DriveFileCategory } from '@refly/openapi-schema';

// Code and text file extensions - these should always be treated as documents
export const CODE_FILE_EXTENSIONS = [
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
export const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'tiff',
  'tif',
];
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'];
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'mpga'];

const CONTENT_TYPE_TO_CATEGORY = {
  'application/pdf': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'text/markdown': 'document',
  'text/plain': 'document',
  'application/epub+zip': 'document',
  'text/html': 'document',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/aac': 'audio',
  'audio/webm': 'audio',
};

/**
 * Map MIME type to file extension
 */
const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  'text/plain': '.txt',
  'text/html': '.html',
  'text/css': '.css',
  'text/javascript': '.js',
  'text/markdown': '.md',
  'application/json': '.json',
  'application/pdf': '.pdf',
  'application/xml': '.xml',
  'application/zip': '.zip',
  'application/epub+zip': '.epub',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/aac': '.aac',
  'audio/webm': '.weba',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
};

/**
 * Get file extension from filename
 */
export const getFileExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDotIndex + 1).toLowerCase();
};

/**
 * Get the correct MIME type for a file, considering code file extensions
 * This prevents issues like .ts being detected as video/mp2t
 */
export const getSafeMimeType = (filename: string, fallbackMime?: string): string => {
  const extension = getFileExtension(filename);

  // Code and text files should always use text/plain or application/octet-stream
  if (CODE_FILE_EXTENSIONS.includes(extension)) {
    // Use specific MIME types for known text formats
    if (['svg'].includes(extension)) return 'image/svg+xml';
    if (['md', 'markdown'].includes(extension)) return 'text/markdown';
    if (['json'].includes(extension)) return 'application/json';
    if (['xml'].includes(extension)) return 'application/xml';
    if (['html'].includes(extension)) return 'text/html';
    if (['css', 'scss', 'sass', 'less'].includes(extension)) return 'text/css';
    if (['js', 'jsx', 'mjs', 'cjs'].includes(extension)) return 'application/javascript';
    // For other code files, use text/plain
    return 'text/plain';
  }

  // Use fallback MIME type if provided
  return fallbackMime || 'application/octet-stream';
};

/**
 * Check if a MIME type represents a plain text file that can be read directly
 * @param mimeType - The MIME type to check
 * @returns true if the file is a plain text file
 */
export const isPlainTextMimeType = (mimeType: string): boolean => {
  if (!mimeType) return false;

  const normalizedType = mimeType.toLowerCase();

  // All text/* types
  if (normalizedType.startsWith('text/')) {
    return true;
  }

  // Common text-based application types
  const textBasedApplicationTypes = [
    'application/json',
    'application/javascript',
    'application/typescript',
    'application/xml',
    'application/x-yaml',
    'application/yaml',
    'application/toml',
    'application/x-sh',
    'application/x-shellscript',
    'application/sql',
    'application/graphql',
    'application/x-httpd-php',
    'application/x-perl',
    'application/x-python',
    'application/x-ruby',
    'application/x-latex',
  ];

  return textBasedApplicationTypes.includes(normalizedType);
};

export const getFileCategory = (contentType: string): DriveFileCategory => {
  return CONTENT_TYPE_TO_CATEGORY[contentType] || 'document';
};

/**
 * Get file category by filename extension with MIME type fallback.
 * Priority: Code files → Extension → MIME type → default 'document'
 *
 * This is the recommended method for determining file category when you have
 * the filename available, as it handles edge cases like .ts files being
 * incorrectly detected as video/mp2t.
 *
 * @param filename - The filename (with extension)
 * @param mimeType - Optional MIME type as fallback
 * @returns The file category
 */
export const getFileCategoryByName = (filename: string, mimeType?: string): DriveFileCategory => {
  const extension = getFileExtension(filename);

  // Priority 1: Code files → document (prevents .ts being detected as video)
  if (CODE_FILE_EXTENSIONS.includes(extension)) {
    return 'document';
  }

  // Priority 2: Check by extension
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (AUDIO_EXTENSIONS.includes(extension)) return 'audio';

  // Priority 3: MIME type fallback (use prefix matching like frontend)
  if (mimeType) {
    const mimeTypePrefix = mimeType.split('/')[0].toLowerCase();
    if (mimeTypePrefix === 'image') return 'image';
    if (mimeTypePrefix === 'audio') return 'audio';
    if (mimeTypePrefix === 'video') return 'video';
  }

  // Default to document
  return 'document';
};

/**
 * Get file extension from MIME type
 * @param mimeType - The MIME type to convert
 * @returns File extension with leading dot (e.g., '.txt') or empty string if not found
 */
export const getExtensionFromMimeType = (mimeType: string): string => {
  if (!mimeType) return '';
  return MIME_TYPE_TO_EXTENSION[mimeType.toLowerCase()] || '';
};

/**
 * Generate filename with proper extension based on MIME type
 * @param name - The base filename (may or may not have extension)
 * @param mimeType - The MIME type of the file
 * @returns Filename with proper extension
 */
export const generateFilenameWithExtension = (name: string, mimeType: string): string => {
  const baseName = name || 'attachment';

  // Check if name already has an extension (up to 10 chars like .markdown, .dockerfile)
  const lastDotIndex = baseName.lastIndexOf('.');
  if (lastDotIndex > 0 && lastDotIndex > baseName.length - 11) {
    // Name already has an extension
    return baseName;
  }

  // Add extension based on MIME type
  const ext = getExtensionFromMimeType(mimeType);
  return ext ? `${baseName}${ext}` : baseName;
};
