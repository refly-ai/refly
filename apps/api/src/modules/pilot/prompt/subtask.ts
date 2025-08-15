import { SkillInput } from '@refly/openapi-schema';

export function buildSubtaskSkillInput(params: {
  userQuestion: string;
  query: string;
  locale?: string;
}): SkillInput {
  const { userQuestion, query } = params;

  const prompt = `ROLE:
You are executing a focused subtask as part of a larger multi-epoch plan.

GOAL CONTEXT:
- Original user goal: "${userQuestion}"

THIS SUBTASK:
- Query: "${query}"
`;

  return { query: prompt };
}
