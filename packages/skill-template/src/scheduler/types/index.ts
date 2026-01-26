import { BaseMessage } from '@langchain/core/messages';
import { BaseSkillState } from '../../base';

export interface QueryProcessorResult {
  optimizedQuery: string;
  query: string;
  usedChatHistory: any[];
  hasContext: boolean;
  remainingTokens: number;
  mentionedContext: any;
}

export interface GraphState extends BaseSkillState {
  /**
   * Accumulated messages.
   */
  messages: BaseMessage[];
}
