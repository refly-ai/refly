import { randomUUID } from 'node:crypto';

type ToolExecutionCallType = 'ptc' | 'standalone';

export const generateToolExecutionCallId = (callType: ToolExecutionCallType): string => {
  return `${callType}_${randomUUID()}`;
};
