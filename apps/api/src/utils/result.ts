import { SkillEvent } from '@refly-packages/common-types';
import { Prisma } from '@prisma/client';
import { Artifact, TokenUsageItem } from '@refly-packages/openapi-schema';
import { SkillRunnableMeta } from '@refly-packages/skill-template';

import { aggregateTokenUsage } from '@refly-packages/utils';
interface StepData {
  name: string;
  content: string;
  structuredData: Record<string, unknown>;
  artifacts: Record<string, Artifact>;
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
  private aborted: boolean = false;

  private getOrInitData(step: string): StepData {
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
      structuredData: {},
      artifacts: {},
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
        if (event.structuredDataKey) {
          step.structuredData[event.structuredDataKey] = event.content;
        }
        break;
    }
    this.data[step.name] = step;
  }

  addUsageItem(meta: SkillRunnableMeta, usage: TokenUsageItem) {
    const step = this.getOrInitData(meta.step?.name);
    step.usageItems.push(usage);
    this.data[step.name] = step;
  }

  handleStreamContent(meta: SkillRunnableMeta, content: string) {
    if (this.aborted) {
      return;
    }

    const step = this.getOrInitData(meta.step?.name);

    step.content += content;

    this.data[step.name] = step;
  }

  getSteps({ resultId }: { resultId: string }): Prisma.ActionStepCreateManyInput[] {
    return this.stepNames.map((stepName, order) => {
      const { name, content, structuredData, artifacts, usageItems } = this.data[stepName];
      const aggregatedUsage = aggregateTokenUsage(usageItems);

      return {
        name,
        content,
        resultId,
        order,
        structuredData: JSON.stringify(structuredData),
        artifacts: JSON.stringify(Object.values(artifacts)),
        tokenUsage: JSON.stringify(aggregatedUsage),
      };
    });
  }
}
