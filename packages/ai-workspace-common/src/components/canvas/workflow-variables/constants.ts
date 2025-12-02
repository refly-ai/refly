import { VariableResourceType } from '@refly/openapi-schema';

export const MAX_OPTIONS = 20;

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
];

export const DOCUMENT_FILE_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'pdf',
  'html',
  'docx',
  'epub',
  ...CODE_FILE_EXTENSIONS,
];
export const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'bmp', 'webp', 'svg'];
export const AUDIO_FILE_EXTENSIONS = ['mp3', 'm4a', 'wav', 'mpga', 'ogg', 'flac', 'aac'];
export const VIDEO_FILE_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'wmv'];

export const ACCEPT_FILE_EXTENSIONS = [
  ...DOCUMENT_FILE_EXTENSIONS,
  ...IMAGE_FILE_EXTENSIONS,
  ...AUDIO_FILE_EXTENSIONS,
  ...VIDEO_FILE_EXTENSIONS,
];

export const FILE_SIZE_LIMITS = {
  document: 20, // 20MB
  image: 10, // 10MB
  audio: 50, // 50MB
  video: 100, // 100MB
  unknown: 100, // 100MB
} as const;

export const RESOURCE_TYPE = ['document', 'image', 'audio', 'video'] as VariableResourceType[];
