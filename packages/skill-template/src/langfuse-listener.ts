import { EventEmitter } from 'events';
import { createId } from '@paralleldrive/cuid2';
import type { SkillEventMap } from './base';
import type { SkillEvent } from '@refly/openapi-schema';
import { getTraceManager, type TraceManager } from '@refly/observability';

interface LangfuseListenerConfig {
  enabled?: boolean;
  includeEvents?: string[];
  excludeEvents?: string[];
  sensitiveKeys?: string[];
}

/**
 * Langfuse event listener for skill events
 */
export class LangfuseListener {
  private traceManager: TraceManager | null = null;
  private activeTraces = new Map<string, string>(); // resultId -> traceId
  private config: Required<LangfuseListenerConfig>;

  constructor(config: LangfuseListenerConfig = {}) {
    this.config = {
      enabled: true,
      includeEvents: [],
      excludeEvents: [],
      sensitiveKeys: ['password', 'token', 'key', 'secret', 'auth'],
      ...config,
    };

    if (this.config.enabled) {
      this.traceManager = getTraceManager();
    }
  }

  /**
   * Attach listener to skill event emitter
   */
  attachToEmitter(emitter: EventEmitter<SkillEventMap>): void {
    if (!this.traceManager || !this.config.enabled) return;

    emitter.on('start', this.handleStart.bind(this));
    emitter.on('end', this.handleEnd.bind(this));
    emitter.on('token_usage', this.handleTokenUsage.bind(this));
    emitter.on('error', this.handleError.bind(this));
    emitter.on('create_node', this.handleCreateNode.bind(this));
    emitter.on('log', this.handleLog.bind(this));
    emitter.on('stream', this.handleStream.bind(this));
    emitter.on('artifact', this.handleArtifact.bind(this));
    emitter.on('structured_data', this.handleStructuredData.bind(this));
  }

  private shouldProcessEvent(eventType: string): boolean {
    if (this.config.includeEvents.length > 0) {
      return this.config.includeEvents.includes(eventType);
    }
    return !this.config.excludeEvents.includes(eventType);
  }

  private desensitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const result = Array.isArray(data) ? [...data] : { ...data };

    for (const [key, value] of Object.entries(result)) {
      if (
        this.config.sensitiveKeys.some((sensitiveKey) =>
          key.toLowerCase().includes(sensitiveKey.toLowerCase()),
        )
      ) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.desensitizeData(value);
      }
    }

    return result;
  }

  private handleStart(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('start')) return;

    const traceId = createId();
    const resultId = event.resultId || createId();

    this.activeTraces.set(resultId, traceId);

    this.traceManager.createTrace(traceId, event.skillMeta?.name || 'Unknown Skill', {
      version: event.version ? String(event.version) : undefined,
      metadata: {
        eventType: 'skill_start',
        resultId,
        event: this.desensitizeData(event.event),
        skillMeta: this.desensitizeData(event.skillMeta),
        step: String(event.step),
        originalResultId: event.resultId,
      },
    });
  }

  private handleEnd(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('end')) return;

    const resultId = event.resultId;
    if (!resultId) return;

    const traceId = this.activeTraces.get(resultId);
    if (!traceId) return;

    // End the trace with output data
    this.traceManager.endTrace(
      traceId,
      this.desensitizeData({
        event: event.event,
        content: event.content,
        reasoningContent: event.reasoningContent,
      }),
    );

    // Clean up
    this.activeTraces.delete(resultId);
  }

  private handleTokenUsage(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('token_usage')) return;

    const resultId = event.resultId;
    if (!resultId) return;

    const traceId = this.activeTraces.get(resultId);
    if (!traceId) return;

    const spanId = createId();
    this.traceManager.createSpan(traceId, spanId, {
      name: 'Token Usage',
      input: this.desensitizeData({
        tokenUsage: event.tokenUsage,
      }),
      metadata: {
        eventType: 'token_usage',
        resultId,
        version: event.version,
      },
    });
  }

  private handleError(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('error')) return;

    const resultId = event.resultId;
    if (!resultId) return;

    const traceId = this.activeTraces.get(resultId);
    if (!traceId) return;

    const spanId = createId();
    this.traceManager.createSpan(traceId, spanId, {
      name: 'Error',
      level: 'ERROR',
      statusMessage: event.originError || 'Unknown error',
      input: this.desensitizeData({
        error: event.error,
        originError: event.originError,
      }),
      metadata: {
        eventType: 'error',
        resultId,
        version: event.version,
      },
    });
  }

  private handleCreateNode(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('create_node')) return;

    const resultId = event.resultId;
    if (!resultId) return;

    const traceId = this.activeTraces.get(resultId);
    if (!traceId) return;

    const spanId = createId();
    this.traceManager.createSpan(traceId, spanId, {
      name: 'Create Node',
      input: this.desensitizeData({
        node: event.node,
      }),
      metadata: {
        eventType: 'create_node',
        resultId,
        version: event.version,
      },
    });
  }

  private handleLog(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('log')) return;

    const resultId = event.resultId;
    if (!resultId) return;

    const traceId = this.activeTraces.get(resultId);
    if (!traceId) return;

    const spanId = createId();
    this.traceManager.createSpan(traceId, spanId, {
      name: 'Log',
      input: this.desensitizeData({
        log: event.log,
      }),
      metadata: {
        eventType: 'log',
        resultId,
        version: event.version,
      },
    });
  }

  private handleStream(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('stream')) return;

    const resultId = event.resultId;
    if (!resultId) return;

    const traceId = this.activeTraces.get(resultId);
    if (!traceId) return;

    const spanId = createId();
    this.traceManager.createSpan(traceId, spanId, {
      name: 'Stream',
      input: this.desensitizeData({
        content: event.content,
        reasoningContent: event.reasoningContent,
      }),
      metadata: {
        eventType: 'stream',
        resultId,
        version: event.version,
      },
    });
  }

  private handleArtifact(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('artifact')) return;

    const resultId = event.resultId;
    if (!resultId) return;

    const traceId = this.activeTraces.get(resultId);
    if (!traceId) return;

    const spanId = createId();
    this.traceManager.createSpan(traceId, spanId, {
      name: 'Artifact',
      input: this.desensitizeData({
        artifact: event.artifact,
      }),
      metadata: {
        eventType: 'artifact',
        resultId,
        version: event.version,
      },
    });
  }

  private handleStructuredData(event: SkillEvent) {
    if (!this.traceManager || !this.shouldProcessEvent('structured_data')) return;

    const resultId = event.resultId;
    if (!resultId) return;

    const traceId = this.activeTraces.get(resultId);
    if (!traceId) return;

    const spanId = createId();
    this.traceManager.createSpan(traceId, spanId, {
      name: 'Structured Data',
      input: this.desensitizeData({
        structuredData: event.structuredData,
      }),
      metadata: {
        eventType: 'structured_data',
        resultId,
        version: event.version,
      },
    });
  }

  /**
   * Clean up all active traces
   */
  detach(): void {
    this.activeTraces.clear();
  }
}
