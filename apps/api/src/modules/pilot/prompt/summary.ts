import type { SkillInput } from '@refly/openapi-schema';

/**
 * Build the SkillInput for Summary step.
 * The prompt itself is in English, while the required output language follows locale.
 */
export function buildSummarySkillInput(params: {
  userQuestion: string;
  currentEpoch: number;
  maxEpoch: number;
  locale?: string;
  subtaskTitles?: string[];
}): SkillInput {
  const { userQuestion, currentEpoch, maxEpoch, locale, subtaskTitles = [] } = params;

  // Normalize display locale; default to en-US if not provided
  const displayLocale = locale ?? 'en-US';

  // Determine if this is the final epoch or approaching the limit
  const isLastEpoch = currentEpoch >= maxEpoch;
  const isApproachingLimit = currentEpoch === maxEpoch - 1;

  // Optional section listing subtask titles to help the model focus
  const subtaskListSection = subtaskTitles?.length
    ? `\n- Subtasks in this epoch:\n${subtaskTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
    : '';

  // Epoch context and urgency indicators
  const epochContextSection = `
EPOCH CONTEXT:
- Current Epoch: ${currentEpoch}/${maxEpoch}
- Progress Status: ${isLastEpoch ? 'FINAL EPOCH - Must complete the task' : isApproachingLimit ? 'Approaching deadline - Consider wrapping up' : 'In progress'}${isLastEpoch ? "\n- CRITICAL: This is your last opportunity to complete the user's request. You MUST produce a comprehensive final output." : ''}${isApproachingLimit ? '\n- IMPORTANT: The next epoch will be the last. Consider if you have enough information to conclude.' : ''}`;

  // English prompt with strict instructions to output in locale
  const query = `ROLE:
You are a world-class prompt engineer and agent engineer.

OBJECTIVE:
Given the runtime-provided context (context + resultHistory) and the original user goal, generate:
1) A phase structured report in human-readable Markdown summarizing the current epoch outputs.
2) A multi-dimensional gap analysis against the original goal and an actionable next-epoch plan (Next-Epoch Plan) with concrete, prioritized actions ready for direct execution.

OUTPUT LANGUAGE:
Write the entire output in ${displayLocale}. Do not use any other language.

INPUTS:
- Original user goal (userQuestion): "${userQuestion}"
- Context usage policy: read from provided context (resources/documents/codeArtifacts/contentList) and resultHistory (previous skill responses). When citing evidence, include their IDs like [doc:ID], [res:ID], [artifact:ID], or [result:ID] for traceability.${subtaskListSection}
${epochContextSection}

REQUIRED OUTPUTS (Markdown):
1) Phase Structured Report
   - Title
   - Executive Summary (3-6 bullet points)
   - Key Findings & Conclusions (grouped by topic; each key statement must cite evidence IDs)
   - Deliverables Produced (documents/code/intermediate results with their IDs)
   - Risks & Uncertainties
   - Open Questions & Pending Hypotheses
2) Gap Analysis & Next-Epoch Plan
   - Alignment with the original goal (coverage, depth, timeliness, reliability, contradictions, completeness)
   - Missing Information List (e.g., missing topics/data/validation/comparisons/sources)
   - Next-Epoch Action Plan (prioritized and execution-ready): for each action, provide
     * Suggested tool (one of: webSearch, librarySearch, commonQnA, generateDoc, codeArtifacts, generateMedia)
     * A focused query
     * Expected context types/IDs to reference or collect
     * Rationale and expected success criteria
   - Decision: Are we ready to produce the final output? (Yes/No + rationale)
   - Subtask-Summary loop optimizations (how to organize subtasks, parallel vs sequential, prompt parameters/model choices, evaluation criteria)

MACHINE-READABLE PLAN (Markdown fenced code block):
Provide, at the end, a machine-readable block in Markdown using a fenced code block with json language tag.
The structure must be exactly:
\`\`\`json
{
  "readyForFinal": boolean,
  "reason": string,
  "nextEpochPlan": [
    {
      "priority": number,
      "skillName": "webSearch" | "librarySearch" | "commonQnA" | "generateDoc" | "codeArtifacts" | "generateMedia",
      "query": string,
      "contextHints": string[],
      "rationale": string
    }
  ]
}
\`\`\`

READINESS DECISION GUIDANCE:
- Set "readyForFinal": true if:
  ${isLastEpoch ? '• THIS IS THE FINAL EPOCH - You MUST set readyForFinal=true and provide comprehensive completion' : "• You have sufficient information to fully answer the user's question"}
  • You can provide a complete, actionable response
  • Further research would not significantly improve the answer
  ${isLastEpoch ? '• Time constraint requires immediate completion' : ''}
- Set "readyForFinal": false only if:
  ${isLastEpoch ? '• NEVER in final epoch - you must complete the task' : '• Critical information is missing and obtainable'}
  ${isLastEpoch ? '' : '• The current findings are insufficient for a quality response'}
  ${isLastEpoch ? '' : '• Additional analysis would substantially improve the outcome'}

CONSTRAINTS:
- Only infer from the available context/history; explicitly mark unknowns.
- Every important conclusion must cite evidence IDs.
- Use clear headings and subsections to maximize readability for humans.

QUALITY GUARD:
- Include a "Quality Checklist" section confirming:
  1) All key statements cite evidence IDs
  2) Next-Epoch Plan actions are specific and feasible
  3) Language exactly matches ${displayLocale}
  4) Decision and rationale are consistent with evidence
  5) No scope creep beyond the current goal

FINAL NOTE:
End with a concise Decision Highlights section (3-5 bullets).`;

  return { query };
}
