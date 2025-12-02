import { countToken, countMessagesTokens } from './token';
import { LLMModelConfig } from '@refly/openapi-schema';
import { BaseMessage } from '@langchain/core/messages';

interface TruncationContext {
  modelInfo: LLMModelConfig;
  currentMessages: BaseMessage[];
  toolResult: string;
  toolName: string;
}

interface TruncationStrategy {
  maxToolResultTokens: number;
  shouldTruncateHistory: boolean;
  keepTokenRatio: number; // 工具结果保留比例
  usageRatio: number;
}

export class ToolResultTruncator {
  /**
   * 计算当前对话的token使用率
   */
  private calculateUsageRatio(
    messages: BaseMessage[],
    contextLimit: number,
  ): { currentTokens: number; usageRatio: number; remainingTokens: number } {
    const currentTokens = countMessagesTokens(messages);
    const usageRatio = currentTokens / contextLimit;
    const remainingTokens = contextLimit - currentTokens;

    return { currentTokens, usageRatio, remainingTokens };
  }

  /**
   * 根据使用率决定截断策略
   */
  private getTruncationStrategy(
    usageRatio: number,
    remainingTokens: number,
    modelInfo: LLMModelConfig,
  ): TruncationStrategy {
    const maxOutput = modelInfo.maxOutput || 8_000;

    // 预留输出空间
    const availableTokens = Math.max(0, remainingTokens - maxOutput);

    if (usageRatio >= 0.8) {
      // 危险区：激进截断
      return {
        maxToolResultTokens: Math.min(2_000, Math.floor(availableTokens * 0.3)),
        shouldTruncateHistory: true,
        keepTokenRatio: 0.2, // 只保留20%
        usageRatio,
      };
    } else if (usageRatio >= 0.6) {
      // 警告区：中等截断
      return {
        maxToolResultTokens: Math.min(5_000, Math.floor(availableTokens * 0.5)),
        shouldTruncateHistory: false,
        keepTokenRatio: 0.5, // 保留50%
        usageRatio,
      };
    } else {
      // 安全区：轻度截断
      return {
        maxToolResultTokens: Math.min(10_000, Math.floor(availableTokens * 0.7)),
        shouldTruncateHistory: false,
        keepTokenRatio: 0.8, // 保留80%
        usageRatio,
      };
    }
  }

  /**
   * 智能截断工具结果
   */
  truncateToolResult(context: TruncationContext): {
    truncatedResult: string;
    originalTokens: number;
    truncatedTokens: number;
    strategy: TruncationStrategy;
  } {
    const { modelInfo, currentMessages, toolResult } = context;
    const contextLimit = modelInfo.contextLimit || 100_000;

    // 1. 计算当前使用率
    const { usageRatio, remainingTokens } = this.calculateUsageRatio(currentMessages, contextLimit);

    // 2. 决定截断策略
    const strategy = this.getTruncationStrategy(usageRatio, remainingTokens, modelInfo);

    // 3. 计算工具结果的tokens
    const originalTokens = countToken(toolResult);

    // 4. 如果在限制内，直接返回
    if (originalTokens <= strategy.maxToolResultTokens) {
      return {
        truncatedResult: toolResult,
        originalTokens,
        truncatedTokens: originalTokens,
        strategy,
      };
    }

    // 5. 需要截断
    const truncatedResult = this.smartTruncate(
      toolResult,
      strategy.maxToolResultTokens,
      strategy.keepTokenRatio,
    );

    return {
      truncatedResult,
      originalTokens,
      truncatedTokens: countToken(truncatedResult),
      strategy,
    };
  }

  /**
   * 智能截断 - 尝试保留JSON结构
   */
  private smartTruncate(content: string, maxTokens: number, keepRatio: number): string {
    // 1. 尝试解析为JSON
    try {
      const parsed = JSON.parse(content);
      return this.truncateJSON(parsed, maxTokens, keepRatio);
    } catch {
      // 不是JSON，按文本截断
      return this.truncateText(content, maxTokens, keepRatio);
    }
  }

  /**
   * 截断JSON - 保留结构
   */
  private truncateJSON(obj: any, maxTokens: number, keepRatio: number): string {
    if (Array.isArray(obj)) {
      // 数组：保留前面的元素
      const keepCount = Math.max(1, Math.floor(obj.length * keepRatio));
      const truncated = obj.slice(0, keepCount);

      const result = {
        data: truncated,
        __metadata: {
          truncated: true,
          originalLength: obj.length,
          returnedLength: truncated.length,
        },
      };

      const jsonStr = JSON.stringify(result, null, 2);
      const tokens = countToken(jsonStr);

      // 如果还是太大，进一步截断
      if (tokens > maxTokens) {
        return this.truncateText(jsonStr, maxTokens, keepRatio);
      }

      return jsonStr;
    }

    if (typeof obj === 'object' && obj !== null) {
      // 对象：保留重要字段
      const priorityKeys = ['id', 'name', 'title', 'type', 'status', 'message', 'error', 'data'];
      const result: any = {};
      let currentTokens = 2; // {}

      // 先添加优先级字段
      for (const key of priorityKeys) {
        if (key in obj) {
          const value = obj[key];
          const fieldStr = JSON.stringify({ [key]: value });
          const fieldTokens = countToken(fieldStr);

          if (currentTokens + fieldTokens < maxTokens * 0.8) {
            result[key] = value;
            currentTokens += fieldTokens;
          }
        }
      }

      // 添加其他字段直到达到限制
      for (const [key, value] of Object.entries(obj)) {
        if (priorityKeys.includes(key)) continue;

        const fieldStr = JSON.stringify({ [key]: value });
        const fieldTokens = countToken(fieldStr);

        if (currentTokens + fieldTokens + 50 > maxTokens) {
          result.__metadata = {
            truncated: true,
            missingFields: Object.keys(obj).filter((k) => !(k in result)),
          };
          break;
        }

        result[key] = value;
        currentTokens += fieldTokens;
      }

      return JSON.stringify(result, null, 2);
    }

    // 基本类型
    return String(obj);
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxTokens: number, keepRatio: number): string {
    const words = text.split(/\s+/);
    const keepWords = Math.floor(words.length * keepRatio);

    let truncated = '';
    let currentTokens = 0;

    for (let i = 0; i < keepWords && i < words.length; i++) {
      const word = words[i];
      const wordTokens = countToken(word);

      if (currentTokens + wordTokens > maxTokens) break;

      truncated += (truncated ? ' ' : '') + word;
      currentTokens += wordTokens;
    }

    return `${truncated}\n\n[... truncated ${words.length - keepWords} words ...]`;
  }
}

// 单例
export const toolResultTruncator = new ToolResultTruncator();
