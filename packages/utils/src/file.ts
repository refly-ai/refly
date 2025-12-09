import { DriveFileCategory } from '@refly/openapi-schema';

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
 * Get file extension from filename
 */
const getFileExtension = (filename: string): string => {
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
