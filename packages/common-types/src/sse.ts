import { CanvasNode, SkillMeta, Artifact, ActionStepMeta, TokenUsageItem } from '@refly-packages/openapi-schema';

export interface SkillEvent {
  /**
   * The event type
   */
  event: 'start' | 'end' | 'stream' | 'log' | 'artifact' | 'structured_data' | 'token_usage' | 'create_node' | 'error';
  /**
   * The action step name
   */
  step?: ActionStepMeta;
  /**
   * The result ID
   */
  resultId?: string;
  /**
   * Event content.
   *
   * - For `start` and `end` events, `content` will be empty.
   * - For `stream` events, `content` will typically be a single token chunk.
   * - For `log` events, `content` will be the log message.
   * - For `structured_data` events, `content` will be serialized JSON data.
   * - For `error` events, `content` will be the serialized BaseResponse object.
   */
  content?: string;
  /**
   * Token usage data. Only present when `event` is `token_usage`.
   */
  tokenUsage?: TokenUsageItem;
  /**
   * Skill metadata
   */
  skillMeta?: SkillMeta;
  /**
   * Key for structured data, such as `relatedQuestions` and `sources`.
   * Only present when `event` is `structured_data`.
   */
  structuredDataKey?: string;
  /**
   * Artifact data. Only present when `event` is `artifact`.
   */
  artifact?: Artifact;
  /**
   * Canvas node data. Only present when `event` is `create_node`.
   */
  node?: CanvasNode;
}
