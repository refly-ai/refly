import { WorkflowVariable, CanvasContext, HistoricalData } from './variable-extraction.dto';

// Import examples for reference and testing
import { VARIABLE_EXTRACTION_EXAMPLES } from './examples';

/**
 * Unified intelligent prompt builder for variable extraction
 * Automatically adapts based on context complexity and historical data
 * Use cases: all variable extraction scenarios, automatically selects optimal strategy
 */
export function buildUnifiedPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
  historicalData?: HistoricalData,
): string {
  const existingVarsText = buildExistingVariablesText(existingVariables);
  const canvasContextText = buildCanvasContextText(canvasContext);
  const historicalContextText = buildHistoricalContextText(historicalData);

  return `# Variable Extraction Task

## Task Description
Extract workflow variables from the user's prompt and generate a processed template. The goal is to identify variables that can be parameterized to make the workflow reusable.

## User Input
${userPrompt}

## Canvas Context
${canvasContextText}

## Existing Variables
${existingVarsText}

## Historical Context
${historicalContextText}

## Requirements

### 1. Variable Extraction
Extract variables that represent:
- **User inputs**: Names, preferences, requirements, etc.
- **File resources**: Documents, images, data files, etc.
- **Configuration options**: Styles, formats, settings, etc.

### 2. Variable Classification
Classify each variable into one of three types:
- **string**: Text content, descriptions, preferences
- **resource**: Files, documents, data sources
- **option**: Limited choices, style preferences

### 3. Variable Naming
- Use descriptive English names in snake_case format
- Names should be self-explanatory
- Avoid generic names like "input", "data", "file"

### 4. Value Extraction
For each variable, extract the current value from the prompt:
- **For string variables**: Extract the actual text value
- **For resource variables**: Extract file names and types
- **For option variables**: Extract the selected option

## Output Format

Return a JSON object with the following structure:

\`\`\`json
{
  "analysis": {
    "userIntent": "Brief description of what the user wants to accomplish",
    "extractionConfidence": 0.85,
    "complexityScore": 0.6,
    "extractedEntityCount": 3,
    "variableTypeDistribution": {
      "string": 2,
      "resource": 1,
      "option": 0
    }
  },
  "variables": [
    {
      "name": "project_name",
      "value": [
        {
          "type": "text",
          "text": "Marketing Campaign"
        }
      ],
      "description": "Name of the marketing project",
      "variableType": "string",
      "source": "startNode",
      "extractionReason": "User specified project name in prompt",
      "confidence": 0.9
    }
  ],
  "reusedVariables": [
    {
      "detectedText": "existing project template",
      "reusedVariableName": "project_template",
      "confidence": 0.8,
      "reason": "User mentioned using existing template"
    }
  ],
  "processedPrompt": "Create a {{project_name}} using the {{project_template}}",
  "originalPrompt": "Original user input"
}
\`\`\`

## Variable Value Structure

Each variable must have a \`value\` array containing \`VariableValue\` objects:

- **For string variables**: Use \`{"type": "text", "text": "actual value"}\`
- **For resource variables**: Use \`{"type": "resource", "resource": {"name": "file_name", "fileType": "document", "storageKey": ""}}\`
- **For option variables**: Use \`{"type": "text", "text": "selected_option"}\`

## Quality Standards
- Variable names: Clear, consistent, self-explanatory
- Variable types: Accurate classification, conforming to three type definitions
- Reuse detection: High accuracy, reduce redundant variables
- Processed template: Maintain original meaning, correct placeholder replacement

${VARIABLE_EXTRACTION_EXAMPLES}

## Key Learning Points from Examples

1. **Variable Naming**: Use descriptive English names in snake_case format (e.g., departure_city, daily_routes)
2. **Type Classification**: 
   - string: Most common for text content, preferences, descriptions
   - resource: For files, data sources, uploads
   - option: For limited choices, style preferences
3. **Template Construction**: Replace specific values with {{variable_name}} placeholders while maintaining semantic meaning
4. **Context Preservation**: Keep the original intent and structure of the user's request`;
}

/**
 * Build existing variable text - internal utility function
 * Purpose: format existing variables into readable text description
 */
function buildExistingVariablesText(existingVariables: WorkflowVariable[]): string {
  if (existingVariables.length === 0) {
    return '- No existing variables';
  }

  return existingVariables
    .map((v) => {
      // Handle new VariableValue structure - display ALL values, not just the first one
      let valueText = 'Empty';
      if (v.value && Array.isArray(v.value) && v.value.length > 0) {
        const valueTexts: string[] = [];

        for (const valueItem of v.value) {
          if (valueItem.type === 'text' && valueItem.text) {
            valueTexts.push(valueItem.text);
          } else if (valueItem.type === 'resource' && valueItem.resource) {
            valueTexts.push(`${valueItem.resource.name} (${valueItem.resource.fileType})`);
          }
        }

        valueText = valueTexts.length > 0 ? valueTexts.join(', ') : 'Empty';
      }

      return `- ${v.name} (${v.variableType}): ${v.description} [Current values: ${valueText}]`;
    })
    .join('\n');
}

/**
 * Build canvas context text - internal utility function
 * Purpose: format canvas context into readable text description
 */
function buildCanvasContextText(canvasContext: CanvasContext): string {
  const parts: string[] = [];

  if (canvasContext.nodeCount > 0) {
    parts.push(`${canvasContext.nodeCount} nodes`);
  }

  if (canvasContext.complexity > 0) {
    const complexityLevel =
      canvasContext.complexity < 30
        ? 'simple'
        : canvasContext.complexity < 70
          ? 'medium'
          : 'complex';
    parts.push(`complexity: ${complexityLevel} (${canvasContext.complexity})`);
  }

  if (canvasContext.resourceCount > 0) {
    parts.push(`${canvasContext.resourceCount} resources`);
  }

  if (canvasContext.workflowType) {
    parts.push(`workflow type: ${canvasContext.workflowType}`);
  }

  if (canvasContext.primarySkills?.length > 0) {
    parts.push(`primary skills: ${canvasContext.primarySkills.join(', ')}`);
  }

  if (parts.length === 0) {
    return '- Basic canvas context';
  }

  return parts.join(', ');
}

/**
 * Build historical context text - internal utility function
 * Purpose: format historical data into readable text description
 */
function buildHistoricalContextText(historicalData?: HistoricalData): string {
  if (!historicalData) {
    return '- No historical data available';
  }

  const parts: string[] = [];

  if (historicalData.extractionHistory?.length > 0) {
    parts.push(`${historicalData.extractionHistory.length} previous extractions`);
  }

  if (historicalData.canvasPatterns?.length > 0) {
    parts.push(`${historicalData.canvasPatterns.length} variable patterns`);
  }

  if (parts.length === 0) {
    return '- Limited historical context';
  }

  return parts.join(', ');
}

// Legacy function for backward compatibility
export function buildVariableExtractionPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
): string {
  return buildUnifiedPrompt(userPrompt, existingVariables, canvasContext);
}
