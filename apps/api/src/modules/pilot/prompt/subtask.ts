import { SkillInput } from '@refly/openapi-schema';
import { ProgressStage } from '../pilot.types';

export function buildSubtaskSkillInput(params: {
  stage: ProgressStage;
  query: string;
  context?: string;
  scope?: string;
  outputRequirements?: string;
  locale?: string;
}): SkillInput {
  const { query, context, scope, outputRequirements, locale = 'auto' } = params;

  const isChinese = locale?.startsWith('zh') || locale === 'zh-CN';

  const _prompt = isChinese
    ? `角色：你正在执行一个多阶段计划中的专注子任务。

上下文：
${context ? `- 前置阶段信息：${context}` : ''}
${scope ? `- 任务范围：${scope}` : ''}
${outputRequirements ? `- 输出要求：${outputRequirements}` : ''}

任务：${query}`
    : `ROLE: You are executing a focused subtask as part of a multi-epoch plan.

CONTEXT:
${context ? `- Previous Stage: ${context}` : ''}
${scope ? `- Task Scope: ${scope}` : ''}
${outputRequirements ? `- Output Requirements: ${outputRequirements}` : ''}

TASK: ${query}`;

  return { query: _prompt };
}
