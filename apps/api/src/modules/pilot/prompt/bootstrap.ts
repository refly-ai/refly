import type { SkillInput } from '@refly/openapi-schema';

/**
 * Build the SkillInput for Bootstrap SummaryAndPlan (GlobalPlan + FirstEpochPlan).
 * This is executed at session startup to provide both global planning and first epoch executable plan.
 * The prompt itself is in English, while the required output language follows locale.
 */
export function buildBootstrapSummaryAndPlanInput(params: {
  userQuestion: string;
  maxEpoch: number;
  locale?: string;
}): SkillInput {
  const { userQuestion, maxEpoch, locale } = params;

  const displayLocale = locale ?? 'en-US';

  const query = `ROLE:
You are a world-class prompt engineer and agent engineer.

OBJECTIVE:
This is the BOOTSTRAP phase. Given the user's goal, you must generate:
1) Global Plan: A strategic roadmap across ${maxEpoch + 1} epochs with clear objectives and success criteria for each epoch.
2) First Epoch Plan: Immediately executable steps for the first epoch (machine-readable JSON).
3) Quality assurance checklist.

OUTPUT LANGUAGE:
Write the entire output in ${displayLocale}. Do not use any other language.

USER GOAL:
"${userQuestion}"

BOOTSTRAP REQUIREMENTS (Markdown):
1) **Global Strategic Roadmap**
   - Overall Strategy (how to approach this goal across ${maxEpoch + 1} epochs)
   - Epoch Breakdown:
     * Epoch 1: Stage, Objective, Success Criteria, Recommended Tools
     * Epoch 2: Stage, Objective, Success Criteria, Recommended Tools
     * Epoch ${maxEpoch + 1}: Stage, Objective, Success Criteria, Recommended Tools
   - Risk Assessment & Contingency Plans

2) **First Epoch Execution Plan**
   - Immediate Objective for Epoch 1
   - Execution Strategy
   - Expected Deliverables

3) **Readiness Assessment**
   - Current Information Status (what we know vs. what we need)
   - First Epoch Scope & Boundaries
   - Success Metrics for Epoch 1

MACHINE-READABLE GLOBAL PLAN AND FIRST EPOCH PLAN (Markdown fenced code block):
Provide a machine-readable block using a fenced code block with json language tag.
The structure must be exactly:
\`\`\`json
{
  "readyForFinal": false,
  "reason": "Starting with research and information gathering in Epoch 1",
  "nextEpochPlan": [
    {
      "name": "Step name",
      "skillName": "webSearch" | "librarySearch" | "commonQnA" | "generateDoc" | "codeArtifacts" | "generateMedia",
      "priority": 1-5,
      "query": "Specific query for this step",
      "contextItemIds": [],
      "workflowStage": "research" | "analysis" | "synthesis" | "creation"
    }
  ],
  "globalPlanning": {
    "overallStrategy": "Brief description of the overall approach strategy",
    "epochBreakdown": [
      {
        "epoch": 1,
        "stage": "Research & Discovery",
        "objective": "Gather comprehensive information and understand the scope",
        "successCriteria": "Complete dataset collected, key factors identified",
        "recommendedTools": ["webSearch", "librarySearch"]
      },
      {
        "epoch": 2,
        "stage": "Analysis & Synthesis", 
        "objective": "Analyze gathered information and develop insights",
        "successCriteria": "Clear patterns identified, actionable insights generated",
        "recommendedTools": ["commonQnA", "generateDoc"]
      }
    ],
    "riskAssessment": "Potential challenges and mitigation strategies"
  }
}
\`\`\`

CONSTRAINTS:
- For bootstrap, readyForFinal should typically be false (we need to gather information first)
- nextEpochPlan should contain 3-5 executable steps for the first epoch
- Steps should follow proper workflow sequencing (research → analysis → synthesis → creation)
- Use appropriate tools for each stage (webSearch/librarySearch for research, commonQnA for analysis, etc.)
- contextItemIds will be empty initially (no prior context)
- globalPlanning.epochBreakdown should cover epochs 1 through ${maxEpoch}
- Each epoch should have distinct objectives and success criteria
- Recommended tools should align with the epoch's stage and objectives

QUALITY GUARD:
Include a "Bootstrap Quality Checklist" section confirming:
1) Global roadmap covers all ${maxEpoch + 1} epochs with clear objectives
2) First epoch plan is immediately executable
3) Language exactly matches ${displayLocale}
4) Machine-readable JSON follows exact schema
5) Steps are properly sequenced and scoped

FINAL NOTE:
End with a "Bootstrap Decision Summary" (3-5 bullets) explaining the strategic approach and first epoch focus.`;

  return { query };
}
