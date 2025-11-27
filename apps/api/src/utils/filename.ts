/**
 * Sanitize and encode filename for Content-Disposition header
 * Ensures RFC 6266 compliance and handles special characters properly
 *
 * @param filename - The original filename
 * @returns Object containing asciiFilename and encodedFilename for Content-Disposition header
 */
export function sanitizeFilename(filename?: string | null): {
  asciiFilename: string;
  encodedFilename: string;
} {
  // Remove any control characters and use fallback if empty
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Need to remove control characters
  const sanitizedFilename = filename?.replace(/[\x00-\x1F\x7F]/g, '') ?? 'download';

  // For filename parameter: replace non-ASCII characters with underscore and escape quotes/backslashes
  // This ensures compatibility with older browsers that don't support filename*
  const asciiFilename = sanitizedFilename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '\\$&');

  // For filename* parameter: use full UTF-8 encoding
  // Modern browsers will prefer this parameter and display the original filename with special characters
  const encodedFilename = encodeURIComponent(sanitizedFilename);

  return {
    asciiFilename,
    encodedFilename,
  };
}

/**
 * Build Content-Disposition header value
 * @param filename - The original filename
 * @param asAttachment - Whether to force download (attachment) or allow inline display
 * @returns Content-Disposition header value
 */
export function buildContentDisposition(filename?: string | null, asAttachment = true): string {
  const { asciiFilename, encodedFilename } = sanitizeFilename(filename);
  const disposition = asAttachment ? 'attachment' : 'inline';

  // RFC 6266 compliant format with both filename and filename* parameters
  // filename*=UTF-8''encoded_name is the modern standard for UTF-8 filenames
  return `${disposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}
