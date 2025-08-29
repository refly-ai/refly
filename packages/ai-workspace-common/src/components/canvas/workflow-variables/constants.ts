import { VariableResourceType } from '@refly/openapi-schema';

export const MAX_OPTIONS = 20;

export const DOCUMENT_FILE_EXTENSIONS = [
  'txt',
  'md',
  'mdx',
  'markdown',
  'pdf',
  'html',
  'xlsx',
  'xls',
  'doc',
  'docx',
  'csv',
  'eml',
  'msg',
  'pptx',
  'ppt',
  'xml',
  'epub',
];

export const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
export const AUDIO_FILE_EXTENSIONS = ['mp3', 'm4a', 'wav', 'amr', 'mpga'];
export const VIDEO_FILE_EXTENSIONS = ['mp4', 'mov', 'mpeg', 'webm'];

export const ACCEPT_FILE_EXTENSIONS = [
  ...DOCUMENT_FILE_EXTENSIONS,
  ...IMAGE_FILE_EXTENSIONS,
  ...AUDIO_FILE_EXTENSIONS,
  ...VIDEO_FILE_EXTENSIONS,
];

export const FILE_SIZE_LIMITS = {
  document: 20 * 1024 * 1024, // 20MB
  image: 10 * 1024 * 1024, // 10MB
  audio: 50 * 1024 * 1024, // 50MB
  video: 100 * 1024 * 1024, // 100MB
  unknown: 100 * 1024 * 1024, // 100MB
} as const;

export const MIME_TYPE_VALIDATION = {
  document: [
    'text/',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/xml',
    'application/epub+zip',
    'message/rfc822',
    'application/vnd.ms-outlook',
  ],
  image: ['image/'],
  audio: ['audio/'],
  video: ['video/'],
} as const;

export const RESOURCE_TYPE = ['document', 'image', 'audio', 'video'] as VariableResourceType[];
