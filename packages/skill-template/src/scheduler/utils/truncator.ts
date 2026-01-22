import { BaseMessage } from '@langchain/core/messages';

export const isEmptyMessage = (message: BaseMessage) => {
  // If the message has tool calls, it is not empty
  if ((message as any).tool_calls && (message as any).tool_calls.length > 0) {
    return false;
  }

  if (typeof message.content === 'string') {
    return message.content.trim() === '';
  }

  if (message.content.length === 0) {
    return true;
  }

  // If the message contains an image, it is not empty
  if (message.content.some((item) => item.type === 'image_url')) {
    return false;
  }

  const textContent = message.content
    .map((item) => (item.type === 'text' ? item.text : ''))
    .join('\n\n');
  return textContent.trim() === '';
};
