/**
 * Media type constants for tool operations
 */

export const MEDIA_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGE: 'image',
  DOC: 'doc',
} as const;

export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES];

/**
 * MIME type mappings for media types
 */
export const MIME_TYPE_MAP: Record<string, MediaType> = {
  // Video
  'video/mp4': MEDIA_TYPES.VIDEO,
  'video/webm': MEDIA_TYPES.VIDEO,
  'video/ogg': MEDIA_TYPES.VIDEO,
  'video/quicktime': MEDIA_TYPES.VIDEO,
  'video/x-msvideo': MEDIA_TYPES.VIDEO,

  // Audio
  'audio/mpeg': MEDIA_TYPES.AUDIO,
  'audio/mp3': MEDIA_TYPES.AUDIO,
  'audio/wav': MEDIA_TYPES.AUDIO,
  'audio/ogg': MEDIA_TYPES.AUDIO,
  'audio/webm': MEDIA_TYPES.AUDIO,
  'audio/aac': MEDIA_TYPES.AUDIO,

  // Image
  'image/jpeg': MEDIA_TYPES.IMAGE,
  'image/jpg': MEDIA_TYPES.IMAGE,
  'image/png': MEDIA_TYPES.IMAGE,
  'image/gif': MEDIA_TYPES.IMAGE,
  'image/webp': MEDIA_TYPES.IMAGE,
  'image/svg+xml': MEDIA_TYPES.IMAGE,

  // Document
  'application/pdf': MEDIA_TYPES.DOC,
  'application/msword': MEDIA_TYPES.DOC,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': MEDIA_TYPES.DOC,
  'application/vnd.ms-excel': MEDIA_TYPES.DOC,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': MEDIA_TYPES.DOC,
  'application/vnd.ms-powerpoint': MEDIA_TYPES.DOC,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': MEDIA_TYPES.DOC,
  'text/plain': MEDIA_TYPES.DOC,
  'text/markdown': MEDIA_TYPES.DOC,
};

/**
 * File extension to media type mapping
 */
export const EXTENSION_MAP: Record<string, MediaType> = {
  // Video
  mp4: MEDIA_TYPES.VIDEO,
  webm: MEDIA_TYPES.VIDEO,
  ogg: MEDIA_TYPES.VIDEO,
  mov: MEDIA_TYPES.VIDEO,
  avi: MEDIA_TYPES.VIDEO,

  // Audio
  mp3: MEDIA_TYPES.AUDIO,
  wav: MEDIA_TYPES.AUDIO,
  oga: MEDIA_TYPES.AUDIO,
  m4a: MEDIA_TYPES.AUDIO,
  aac: MEDIA_TYPES.AUDIO,

  // Image
  jpg: MEDIA_TYPES.IMAGE,
  jpeg: MEDIA_TYPES.IMAGE,
  png: MEDIA_TYPES.IMAGE,
  gif: MEDIA_TYPES.IMAGE,
  webp: MEDIA_TYPES.IMAGE,
  svg: MEDIA_TYPES.IMAGE,

  // Document
  pdf: MEDIA_TYPES.DOC,
  doc: MEDIA_TYPES.DOC,
  docx: MEDIA_TYPES.DOC,
  xls: MEDIA_TYPES.DOC,
  xlsx: MEDIA_TYPES.DOC,
  ppt: MEDIA_TYPES.DOC,
  pptx: MEDIA_TYPES.DOC,
  txt: MEDIA_TYPES.DOC,
  md: MEDIA_TYPES.DOC,
};

/**
 * Get media type from MIME type
 */
export function getMediaTypeFromMime(mimeType: string): MediaType | undefined {
  return MIME_TYPE_MAP[mimeType.toLowerCase()];
}

/**
 * Get media type from file extension
 */
export function getMediaTypeFromExtension(extension: string): MediaType | undefined {
  return EXTENSION_MAP[extension.toLowerCase().replace('.', '')];
}

/**
 * Check if MIME type is valid for a given media type
 */
export function isValidMimeType(mimeType: string, mediaType: MediaType): boolean {
  return getMediaTypeFromMime(mimeType) === mediaType;
}
