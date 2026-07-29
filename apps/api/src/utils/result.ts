import { ActionLog, Artifact, SkillEvent, TokenUsageItem } from '@refly/openapi-schema';
import { SkillRunnableMeta } from '@refly/skill-template';

import { aggregateTokenUsage } from '@refly/utils';
import { Prisma } from '@prisma/client';
import { StepService } from '../modules/step/step.service';

export interface StepData {
  name: string;
  content: string;
  reasoningContent: string;
  structuredData: Record<string, unknown>;
  artifacts: Record<string, Artifact>;
  logs: ActionLog[];
  usageItems: TokenUsageItem[];
}

const PERSIST_DEBOUNCE_MS = 200;

export class ResultAggregator {
  /**
   * Step title list, in the order of sending
   */
  private stepNames: string[] = [];

  /**
   * Message data, with key being the step name and value being the message
   */
  private data: Record<string, StepData> = {};

  /**
   * Whether the skill invocation is aborted
   */
  private aborted = false;

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistInFlight: Promise<void> | null = null;
  private persistDirty = false;
  /** Set when cache was cleared; in-flight writes should not overwrite after clear. */
  private persistCleared = false;

  constructor(
    private readonly stepService: StepService,
    private readonly resultId: string,
    private readonly version: number,
  ) {}

  private getOrInitData(_step: string): StepData {
    let step = _step;
    if (!step) {
      step = 'default';
    }

    const stepData = this.data[step];
    if (stepData) {
      return stepData;
    }

    this.stepNames.push(step);

    return {
      name: step,
      content: '',
      reasoningContent: '',
      structuredData: {},
      artifacts: {},
      logs: [],
      usageItems: [],
    };
  }

  private schedulePersistSteps() {
    // Terminal after clearCache: allow in-memory mutations but never rearm Redis writes.
    if (this.persistCleared) {
      return;
    }
    this.persistDirty = true;
    if (this.persistTimer != null) {
      return;
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flushPersistSteps();
    }, PERSIST_DEBOUNCE_MS);
  }

  /**
   * Force-flush pending snapshot to Redis (latest-wins single-flight).
   * Coalesces concurrent callers; if dirty again after a write, runs one more persist.
   * No-ops Redis writes once clearCache has run (persistCleared is sticky).
   */
  private async flushPersistSteps(): Promise<void> {
    if (this.persistCleared) {
      if (this.persistTimer != null) {
        clearTimeout(this.persistTimer);
        this.persistTimer = null;
      }
      return;
    }

    if (this.persistTimer != null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    // Ensure at least one attempt when explicitly flushed (e.g. getSteps).
    this.persistDirty = true;

    while (this.persistDirty && !this.persistCleared) {
      if (this.persistInFlight) {
        await this.persistInFlight;
        // In-flight may have cleared dirty; if a race left us dirty again, loop.
        continue;
      }

      const run = this.runPersistLoop();
      this.persistInFlight = run;
      try {
        await run;
      } finally {
        if (this.persistInFlight === run) {
          this.persistInFlight = null;
        }
      }
    }
  }

  private async runPersistLoop(): Promise<void> {
    while (this.persistDirty && !this.persistCleared) {
      this.persistDirty = false;
      await this.persistStepsNow();
    }
  }

  private async persistStepsNow() {
    if (this.persistCleared) {
      return;
    }

    try {
      // Generate Map with step name as key and StepData as value
      const stepsMap = new Map<string, StepData>();
      for (const step of Object.values(this.data)) {
        stepsMap.set(step.name, step);
      }

      if (stepsMap.size > 0) {
        // Convert Map to Record for Redis storage
        const steps: Record<string, StepData> = Object.fromEntries(stepsMap);
        const cacheKey = this.stepService.buildCacheKey(this.resultId, this.version);
        // adjust the order of tool calls
        await this.stepService.setCache(cacheKey, steps);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to persist step snapshot to Redis', error);
    }
  }

  abort() {
    this.aborted = true;
    if (this.persistTimer != null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }

  addSkillEvent(event: SkillEvent) {
    if (this.aborted) {
      return;
    }

    const step: StepData = this.getOrInitData(event.step?.name);
    switch (event.event) {
      case 'artifact':
        if (event.artifact) {
          step.artifacts[event.artifact.entityId] = event.artifact;
        }
        break;
      case 'structured_data':
        if (event.structuredData) {
          const structuredData = event.structuredData;
          if (structuredData?.isPartial !== undefined) {
            const existingData = step.structuredData || {};
            const existingSources = (existingData.sources || []) as any[];
            step.structuredData = {
              ...existingData,
              sources: [
                ...existingSources,
                ...(Array.isArray(structuredData.sources) ? structuredData.sources : []),
              ],
              isPartial: structuredData.isPartial,
              chunkIndex: structuredData.chunkIndex,
              totalChunks: structuredData.totalChunks,
            };
          } else {
            step.structuredData = { ...step.structuredData, ...event.structuredData };
          }
        }
        break;
      case 'log':
        if (event.log) {
          step.logs.push(event.log);
        }
    }
    this.data[step.name] = step;
    this.schedulePersistSteps();
  }

  addUsageItem(meta: SkillRunnableMeta, usage: TokenUsageItem) {
    const step = this.getOrInitData(meta.step?.name);
    step.usageItems.push(usage);
    this.data[step.name] = step;
    this.schedulePersistSteps();
  }

  handleStreamContent(meta: SkillRunnableMeta, content: string, reasoningContent?: string) {
    if (this.aborted) {
      return;
    }

    const step = this.getOrInitData(meta.step?.name);

    step.content += content;

    if (reasoningContent) {
      step.reasoningContent += reasoningContent;
    }

    this.data[step.name] = step;
    this.schedulePersistSteps();
  }

  async getSteps({
    resultId,
    version,
  }: {
    resultId: string;
    version: number;
  }): Promise<Prisma.ActionStepCreateManyInput[]> {
    await this.flushPersistSteps();
    return this.stepNames.map((stepName, order) => {
      const { name, content, structuredData, artifacts, usageItems, logs, reasoningContent } =
        this.data[stepName];
      const aggregatedUsage = aggregateTokenUsage(usageItems);

      return {
        name,
        content,
        reasoningContent,
        resultId,
        version,
        order,
        tier: usageItems[0]?.tier,
        structuredData: JSON.stringify(structuredData),
        artifacts: JSON.stringify(Object.values(artifacts)),
        tokenUsage: JSON.stringify(aggregatedUsage),
        logs: JSON.stringify(logs),
      };
    });
  }

  async clearCache() {
    if (this.persistTimer != null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistDirty = false;
    this.persistCleared = true;

    if (this.persistInFlight) {
      await this.persistInFlight;
    }

    await this.stepService.clearCache(this.resultId, this.version);
  }
}
