/**
 * Template Quality Scoring Prompt
 * Used by TemplateScoringService to evaluate workflow template quality
 *
 * New lightweight scoring approach:
 * - Rule-based scoring for structure (60 points)
 * - LLM-based scoring for semantic quality (40 points)
 */

export interface TemplateScoringInput {
  title: string;
  description?: string;
  nodes: Array<{
    id: string;
    type: string;
    title?: string;
    query?: string;
  }>;
  variables: Array<{
    name: string;
    variableType: string;
    description?: string;
  }>;
  /** Skill response inputs (truncated) for semantic evaluation */
  skillInputs?: Array<{
    title?: string;
    input: string; // Truncated to MAX_INPUT_LENGTH
  }>;
}

/**
 * Max length for skill input content (in characters)
 */
export const MAX_INPUT_LENGTH = 300;

/**
 * Truncate text to max length, adding ellipsis if truncated
 */
export function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Lightweight input for LLM semantic scoring
 * Only includes essential info to reduce token usage
 */
export interface LightweightScoringInput {
  title: string;
  description?: string;
  nodeTypes: string[]; // Just node types
  variables: Array<{
    name: string;
    type: string;
  }>;
  /** Truncated skill inputs for understanding workflow purpose */
  skillInputs?: Array<{
    title?: string;
    input: string;
  }>;
}

/**
 * Build lightweight prompt for LLM semantic scoring
 * Only evaluates: generality (通用性) and ease of use (易上手)
 * Max 40 points total
 */
export function buildLightweightScoringPrompt(input: LightweightScoringInput): string {
  const variablesText =
    input.variables.length > 0
      ? input.variables.map((v) => `${v.name}(${v.type})`).join(', ')
      : 'None';

  const skillInputsText =
    input.skillInputs && input.skillInputs.length > 0
      ? input.skillInputs
          .map((s, i) => `[${i + 1}] ${s.title || 'Untitled'}: ${s.input}`)
          .join('\n')
      : 'None';

  return `Score this workflow template (0-40 points total).

Template:
- Title: ${input.title}
- Description: ${input.description || 'None'}
- Node types: ${input.nodeTypes.join(', ') || 'None'}
- Variables: ${variablesText}

Skill prompts:
${skillInputsText}

Score 2 dimensions:
1. Generality (0-20): Is this template useful for many users? Not too specific to one use case?
2. Ease of use (0-20): Are variables clear and easy to understand? Is the workflow logic intuitive?

Return JSON only:
{"generality":<0-20>,"easeOfUse":<0-20>,"feedback":"<one sentence>"}`;
}
