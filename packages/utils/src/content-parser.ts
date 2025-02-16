/**
 * Convert reasoning content to blockquote format
 */
export const getParsedReasoningContent = (reasoningContent?: string): string => {
  if (!reasoningContent) return '';
  return `> ${reasoningContent.split('\n').join('\n> ')}\n\n`;
};

/**
 * Combine reasoning content and main content
 */
export const getWholeParsedContent = (reasoningContent?: string, content?: string): string => {
  const parsedReasoningContent = getParsedReasoningContent(reasoningContent);
  return parsedReasoningContent + (content || '');
};
