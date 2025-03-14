/**
 * Utility functions for content handling
 */

/**
 * Maximum number of characters allowed for node content preview
 */
export const MAX_CONTENT_PREVIEW_LENGTH = 1000;

/**
 * Truncates content to a maximum length
 * @param content The content to truncate
 * @param maxLength Maximum length of the content
 * @returns Truncated content
 */
export const truncateContent = (
  content: string,
  maxLength = MAX_CONTENT_PREVIEW_LENGTH,
): string => {
  if (!content) return '';
  if (content.length <= maxLength) return content;

  return `${content.substring(0, maxLength)}...`;
};

/**
 * Processes an array of content strings, joins them, and truncates to max length
 * @param contents Array of content strings
 * @param separator Separator to use when joining content
 * @param maxLength Maximum length of the resulting content
 * @returns Truncated joined content
 */
export const processContentPreview = (
  contents: (string | undefined)[] = [],
  separator = '\n',
  maxLength = MAX_CONTENT_PREVIEW_LENGTH,
): string => {
  const filteredContents = contents.filter(Boolean) as string[];
  const joinedContent = filteredContents.join(separator);
  return truncateContent(joinedContent, maxLength);
};
