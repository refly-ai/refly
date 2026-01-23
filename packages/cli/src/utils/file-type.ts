/**
 * File type detection utilities for resource variables.
 * Maps file extensions and MIME types to Refly resource types.
 */

import * as path from 'node:path';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'];

/**
 * Refly resource file types
 */
export type ResourceFileType = 'document' | 'image' | 'video' | 'audio';

/**
 * Determine the Refly resource file type based on file path and optional MIME type.
 * Defaults to 'document' for unrecognized types.
 *
 * @param filePath - Path to the file
 * @param mimeType - Optional MIME type (used as fallback)
 * @returns The determined file type
 */
export function determineFileType(filePath: string, mimeType?: string): ResourceFileType {
  // Extract extension without the dot, lowercase
  const ext = path.extname(filePath).slice(1).toLowerCase();

  // Check extension first (most reliable)
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return 'image';
  }
  if (VIDEO_EXTENSIONS.includes(ext)) {
    return 'video';
  }
  if (AUDIO_EXTENSIONS.includes(ext)) {
    return 'audio';
  }

  // Check MIME type as fallback
  if (mimeType) {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.startsWith('video/')) {
      return 'video';
    }
    if (mimeType.startsWith('audio/')) {
      return 'audio';
    }
  }

  // Default to document for all other types (PDF, text, office docs, etc.)
  return 'document';
}
