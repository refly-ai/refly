// Sanitize filename to remove illegal characters
const sanitizeFileName = (name: string): string => {
  return (name || 'file')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Get file extension from Content-Type
export const getExtFromContentType = (contentType?: string | null): string => {
  const ct = (contentType ?? '').toLowerCase();
  if (!ct) return '';
  // Image types
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return 'jpg';
  if (ct.includes('image/png')) return 'png';
  if (ct.includes('image/webp')) return 'webp';
  if (ct.includes('image/gif')) return 'gif';
  if (ct.includes('image/svg')) return 'svg';
  // Document types
  if (ct.includes('application/pdf')) return 'pdf';
  if (ct.includes('application/msword')) return 'doc';
  if (ct.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
    return 'docx';
  }
  // Audio types
  if (ct.includes('audio/mpeg') || ct.includes('audio/mp3')) return 'mp3';
  if (ct.includes('audio/wav') || ct.includes('audio/wave')) return 'wav';
  if (ct.includes('audio/ogg')) return 'ogg';
  if (ct.includes('audio/mp4') || ct.includes('audio/m4a')) return 'm4a';
  if (ct.includes('audio/aac')) return 'aac';
  if (ct.includes('audio/flac')) return 'flac';
  if (ct.includes('audio/webm')) return 'webm';
  // Video types
  if (ct.includes('video/mp4')) return 'mp4';
  if (ct.includes('video/avi') || ct.includes('video/x-msvideo')) return 'avi';
  if (ct.includes('video/quicktime')) return 'mov';
  if (ct.includes('video/webm')) return 'webm';
  if (ct.includes('video/x-matroska')) return 'mkv';
  if (ct.includes('video/x-flv')) return 'flv';
  if (ct.includes('video/ogg')) return 'ogv';
  // Archive types
  if (ct.includes('application/zip')) return 'zip';
  if (ct.includes('application/x-rar-compressed')) return 'rar';
  if (ct.includes('application/x-tar')) return 'tar';
  if (ct.includes('application/gzip')) return 'gz';
  // Text types
  if (ct.includes('text/plain')) return 'txt';
  if (ct.includes('text/markdown')) return 'md';
  if (ct.includes('text/html')) return 'html';
  if (ct.includes('application/json')) return 'json';
  // Try to extract extension from MIME type
  const match = ct.match(/\/([a-z0-9]+)/);
  return match?.[1] ?? '';
};

// Build safe filename with extension
export const buildSafeFileName = (base: string, extHint?: string): string => {
  const sanitizedBase = sanitizeFileName(base);
  const ext = (extHint ?? '').replace(/^\./, '').toLowerCase();
  const hasExt = !!ext && new RegExp(`\\.${ext}$`, 'i').test(sanitizedBase);
  return hasExt ? sanitizedBase : `${sanitizedBase}${ext ? `.${ext}` : ''}`;
};
