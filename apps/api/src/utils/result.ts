import { Prisma } from '../generated/client';
import { ActionLog, Artifact, SkillEvent, TokenUsageItem } from '@refly/openapi-schema';
import { SkillRunnableMeta } from '@refly/skill-template';

import { aggregateTokenUsage } from '@refly/utils';
interface StepData {
  name: string;
  content: string;
  reasoningContent: string;
  structuredData: Record<string, unknown>;
  artifacts: Record<string, Artifact>;
  logs: ActionLog[];
  usageItems: TokenUsageItem[];
}

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

  abort() {
    this.aborted = true;
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
  }

  addUsageItem(meta: SkillRunnableMeta, usage: TokenUsageItem) {
    const step = this.getOrInitData(meta.step?.name);
    step.usageItems.push(usage);
    this.data[step.name] = step;
  }

  handleStreamContent(meta: SkillRunnableMeta, content: string, reasoningContent?: string) {
    if (this.aborted) {
      return;
    }

    const step = this.getOrInitData(meta.step?.name);

    step.content += content;
    step.reasoningContent += reasoningContent;

    this.data[step.name] = step;
  }

  getSteps({
    resultId,
    version,
  }: {
    resultId: string;
    version: number;
  }): Prisma.ActionStepCreateManyInput[] {
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
}
