import { SkillInput } from '@refly/openapi-schema';

export function buildSummarySkillInput(params: {
  userQuestion: string;
  currentEpoch: number;
  maxEpoch: number;
  subtaskTitles?: string[];
}): SkillInput {
  const { userQuestion, currentEpoch, maxEpoch, subtaskTitles = [] } = params;

  const subtaskListSection = subtaskTitles?.length
    ? `\nCompleted subtasks: ${subtaskTitles.map((t, i) => `${i + 1}. ${t}`).join(', ')}`
    : '';

  const progressRatio = currentEpoch / Math.max(maxEpoch, 1);

  let stageFocus = '';
  if (progressRatio < 0.5) {
    stageFocus = `**EARLY STAGE**: Focus on answer completeness assessment for "${userQuestion}"`;
  } else if (progressRatio < 0.75) {
    stageFocus = `**MID STAGE**: Synthesize findings and evaluate answer reliability for "${userQuestion}"`;
  } else {
    stageFocus = `**LATE STAGE**: Finalize answer quality and prepare comprehensive progress report for "${userQuestion}"`;
  }

  const query = `SUMMARY TASK: Context organization and direct answer generation

**TARGET**: "${userQuestion}"
**PROGRESS**: Epoch ${currentEpoch}/${maxEpoch} (${Math.round(progressRatio * 100)}% complete)${subtaskListSection}
${stageFocus}

## WORKFLOW

**PHASE 1: CONTEXT SYNTHESIS**
- Gather and organize all available information from sources
- Identify key themes, patterns, and relationships
- Structure information into logical categories
- Prepare comprehensive context foundation

**PHASE 2: ANSWER GENERATION**
Generate complete answer to: "${userQuestion}"
- Provide comprehensive coverage of all question aspects
- Structure with clear sections and logical flow
- Include relevant examples, data points, and evidence
- Address potential counterarguments or alternatives
- Use clear, professional language
- Include source citations [doc:ID], [res:ID], [artifact:ID]
- Integrate appropriate charts, diagrams, or visual elements where beneficial
- Ensure visual elements enhance understanding without overwhelming text content

**PHASE 3: QUALITY EVALUATION**
Assess answer quality on two dimensions:
- **Completeness**: Percentage of "${userQuestion}" answered
- **Evidence Quality**: Reliability of supporting information

## OUTPUT FORMAT

### COMPLETE ANSWER
[Structured response to "${userQuestion}" with evidence citations]

### QUALITY ASSESSMENT
- **Completeness**: X% - [Explanation]
- **Evidence Quality**: [Strong/Mixed/Weak] - [Reasoning]

**CONSTRAINT**: Maintain absolute focus on "${userQuestion}". Use commonQnA for synthesis.`;

  return { query };
}
