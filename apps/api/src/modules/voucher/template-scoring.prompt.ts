/**
 * Template Quality Scoring Prompt
 * Used by TemplateScoringService to evaluate workflow template quality
 *
 * Scoring dimensions:
 * 1. Structure Completeness (0-30 points) - Node count, connections, flow logic
 * 2. Input Design (0-25 points) - Variable naming, descriptions, parameter count
 * 3. Prompt Quality (0-25 points) - Clarity, task description, context info
 * 4. Reusability (0-20 points) - General value, ease of use, title/description
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
  templateContent?: string;
}

export function buildTemplateScoringPrompt(input: TemplateScoringInput): string {
  const nodesInfo =
    input.nodes.length > 0
      ? input.nodes
          .map(
            (n, i) =>
              `${i + 1}. [${n.type}] ${n.title || 'Unnamed'}\n   Query: ${n.query || 'N/A'}`,
          )
          .join('\n')
      : 'No nodes defined';

  const variablesInfo =
    input.variables.length > 0
      ? input.variables
          .map((v) => `- ${v.name} (${v.variableType}): ${v.description || 'No description'}`)
          .join('\n')
      : 'No variables defined';

  return `# Template Quality Scoring Expert

You are a professional workflow template quality evaluator. Score the following template on a scale of 0-100.

## Scoring Dimensions

### 1. Structure Completeness (0-30 points)
- Reasonable number of nodes (3-10 is ideal)
- Clear node connections without redundancy
- Workflow can execute smoothly

### 2. Input Design (0-25 points)
- Semantic and understandable variable names
- Complete and clear variable descriptions
- Reasonable number of input parameters (2-5 is ideal)

### 3. Prompt Quality (0-25 points)
- Clear and explicit prompts
- Complete task descriptions
- Sufficient context information

### 4. Reusability (0-20 points)
- Template has general value (not too specific)
- Easy for other users to understand and use
- Attractive title and description

## Template Information

### Basic Info
- Title: ${input.title}
- Description: ${input.description || 'No description'}

### Workflow Nodes (${input.nodes.length} total)
${nodesInfo}

### Variables (${input.variables.length} total)
${variablesInfo}

${input.templateContent ? `### Generated Template Content\n${input.templateContent}` : ''}

## Output Format

Return JSON only:

\`\`\`json
{
  "score": <total 0-100>,
  "breakdown": {
    "structure": <0-30>,
    "inputDesign": <0-25>,
    "promptQuality": <0-25>,
    "reusability": <0-20>
  },
  "feedback": "<1-2 sentence improvement suggestion>"
}
\`\`\`

Ensure total score equals sum of breakdown scores.`;
}
