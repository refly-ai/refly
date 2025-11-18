import { DriveFileCategory } from '@refly/openapi-schema';

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

export const getFileCategory = (contentType: string): DriveFileCategory => {
  return CONTENT_TYPE_TO_CATEGORY[contentType] || 'document';
};
