import { WorkflowVariable, CanvasContext, HistoricalData } from './variable-extraction.dto';

// Import examples for reference and testing
import { APP_PUBLISH_EXAMPLES } from './examples';

// Define proper types for canvas data
interface CanvasNode {
  id: string;
  type: string;
  title?: string;
  data?: {
    title?: string;
    content?: string;
  };
  content?: string;
}

interface CanvasDataInput {
  nodes: CanvasNode[];
  variables: WorkflowVariable[];
  title?: string;
  description?: string;
}

/**
 * APP publishing template generation dedicated prompt
 * Generates user-friendly natural language templates based on all original Canvas prompts and variables
 * Used for APP publishing workflow to help users understand and use the workflow
 */
export function buildAppPublishPrompt(
  canvasData: CanvasDataInput,
  canvasContext: CanvasContext,
  historicalData?: HistoricalData,
): string {
  const nodesText = buildNodesText(canvasData.nodes);
  const variablesText = buildVariablesText(canvasData.variables);
  const canvasContextText = buildCanvasContextText(canvasContext);
  const historicalContext = historicalData ? buildHistoricalContext(historicalData) : '';

  return `# AI Workflow APP Template Generation Expert

You are a professional workflow analysis expert responsible for generating user-friendly natural language templates for APP publishing. Your goal is to create intuitive, clear templates that help users understand and use the workflow effectively.

## Core Tasks
1. **Template Generation**: Create natural language templates based on all original prompts and variables
2. **User Experience**: Make templates intuitive and easy to understand
3. **Variable Integration**: Properly integrate all workflow variables into the template
4. **Context Preservation**: Maintain the original workflow intent and functionality

## Input Context

### Workflow Information
${canvasData.title ? `- Title: ${canvasData.title}` : ''}
${canvasData.description ? `- Description: ${canvasData.description}` : ''}

### Canvas Nodes and Prompts
${nodesText}

### Existing Variables
${variablesText}

### Workflow Context
${canvasContextText}

${historicalContext ? `### Historical Learning Context\n${historicalContext}` : ''}

## Template Generation Guidelines

### 1. Natural Language Conversion
- Convert technical workflow descriptions into user-friendly language
- Use clear, actionable language that explains what the workflow does
- Focus on user benefits and outcomes

### 2. Variable Integration
- Replace specific values with {{variable_name}} placeholders
- Ensure all variables are properly represented
- Maintain semantic meaning while making it parameterizable

### 3. Template Structure
- Start with a clear description of what the workflow accomplishes
- Explain what inputs are needed (variables)
- Describe the expected output or result
- Use conversational, helpful tone

### 4. Variable Type Handling
- **string**: Use descriptive placeholders like "{{topic}}" or "{{style}}"
- **resource**: Use file-related placeholders like "{{upload_file}}" or "{{document}}"
- **option**: Use selection-related placeholders like "{{format}}" or "{{mode}}"

### 5. Quality Standards
- Templates should be self-explanatory
- Variables should have clear, descriptive names
- Maintain workflow functionality while improving usability
- Ensure consistency with existing variable names

## Output Format Requirements

**Must** return standard JSON format:

\`\`\`json
{
  "analysis": {
    "userIntent": "Clear description of what this workflow accomplishes",
    "workflowComplexity": "simple|medium|complex",
    "estimatedExecutionTime": "Estimated time for workflow completion",
    "primarySkills": ["Skill1", "Skill2"],
    "targetAudience": "Who this workflow is designed for"
  },
  "template": {
    "title": "User-friendly workflow title",
    "description": "Clear description of what the workflow does",
    "content": "Natural language template with {{variable_name}} placeholders",
    "usageInstructions": "Brief instructions on how to use the template",
    "exampleInputs": {
      "variable_name": "Example value or description"
    }
  },
  "variables": [
    {
      "name": "variable_name",
      "description": "Clear description of what this variable represents",
      "variableType": "string|resource|option",
      "required": true,
      "defaultValue": "Default value if applicable",
      "uiHint": "Suggested UI component type"
    }
  ],
  "metadata": {
    "templateVersion": 1,
    "generatedAt": "2024-01-01T00:00:00Z",
    "workflowType": "Type of workflow",
    "skillTags": ["tag1", "tag2"]
  }
}
\`\`\`

## Key Principles
1. **Clarity**: Users should immediately understand what the workflow does
2. **Simplicity**: Avoid technical jargon, use everyday language
3. **Completeness**: Include all necessary variables and context
4. **Actionability**: Users should know exactly what to provide and expect
5. **Professionalism**: Maintain a helpful, trustworthy tone

## Critical Focus: Workflow Publishing Template String

The **"content"** field in the template object is the most important output - this is the **workflow publishing template string** that will be used by users. It must:

- **Be Natural and Conversational**: Sound like a helpful assistant explaining what they'll do
- **Include All Variables**: Every extracted variable must be represented with {{variable_name}} placeholders
- **Maintain Original Intent**: Preserve the user's original goal and requirements
- **Be Self-Contained**: Users should understand the complete workflow from this single template
- **Use Proper Variable Format**: All placeholders must use {{variable_name}} format exactly

### Template String Examples:

**Before (Technical)**: "Analyze resume with target job description, rewrite content, optimize format for ATS"

**After (User-friendly)**: "I'll help you create a professional resume optimized for your target job. Please provide your {{original_resume}} and the {{target_job_description}}, and I'll rewrite it in {{preferred_language}} with {{output_format}} formatting to ensure it passes ATS screening."

**Before (Technical)**: "Generate travel itinerary based on destination, dates, and preferences"

**After (User-friendly)**: "I'll create a personalized travel plan for your trip to {{destination}} from {{departure_city}} during {{dates}}. I'll arrange {{accommodation}} accommodations and {{food}} dining options, maintaining a {{pace}} pace with {{daily_routes}} for your {{goal}}."

${APP_PUBLISH_EXAMPLES}

## Key Learning Points from Examples

1. **Template String Structure**: 
   - Start with "I'll help you..." or "I'll create..." to establish the assistant role
   - Use natural language that flows conversationally
   - Include all variables with {{variable_name}} placeholders
   - End with clear expectations of what will be delivered

2. **Variable Integration**:
   - Replace specific values with descriptive placeholders
   - Maintain the original semantic meaning
   - Ensure all extracted variables are represented
   - Use consistent naming conventions

3. **User Experience Focus**:
   - Templates should be immediately understandable
   - Avoid technical jargon
   - Focus on benefits and outcomes
   - Provide clear guidance on what users need to provide

4. **Quality Assurance**:
   - Every template string must be complete and self-contained
   - All variables must be properly integrated
   - Templates should maintain the original workflow intent
   - Language should be professional yet approachable`;
}

/**
 * Build nodes text - format canvas nodes into readable description
 */
function buildNodesText(nodes: CanvasNode[]): string {
  if (!nodes?.length) {
    return '- No workflow nodes found';
  }

  return nodes
    .map((node, index) => {
      const nodeType = node.type || 'unknown';
      const nodeTitle = node.data?.title || node.title || `Node ${index + 1}`;
      const nodeContent = node.data?.content || node.content || '';

      let description = `- ${nodeTitle} (${nodeType})`;
      if (nodeContent && typeof nodeContent === 'string' && nodeContent.length > 0) {
        const truncatedContent =
          nodeContent.length > 100 ? `${nodeContent.substring(0, 100)}...` : nodeContent;
        description += `\n  Content: ${truncatedContent}`;
      }

      return description;
    })
    .join('\n');
}

/**
 * Build variables text - format existing variables into readable description
 */
function buildVariablesText(variables: WorkflowVariable[]): string {
  if (!variables?.length) {
    return '- No existing variables';
  }

  return variables
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

      return `- ${v.name} (${v.variableType}): ${v.description || 'No description'} [Current values: ${valueText}]`;
    })
    .join('\n');
}

/**
 * Build canvas context text - format canvas context information
 */
function buildCanvasContextText(canvasContext: CanvasContext): string {
  const {
    nodeCount = 0,
    complexity = 0,
    resourceCount = 0,
    workflowType = 'Generic Workflow',
    primarySkills = ['Content Generation'],
  } = canvasContext;

  return `- Canvas Nodes: ${nodeCount}
- Workflow Type: ${workflowType}
- Primary Skills: ${Array.isArray(primarySkills) ? primarySkills.join(', ') : primarySkills}
- Complexity Score: ${complexity}/100
- Resource Count: ${resourceCount}`;
}

/**
 * Build historical context - analyze historical data for learning
 */
function buildHistoricalContext(historicalData: HistoricalData): string {
  if (!historicalData?.extractionHistory?.length) {
    return 'No historical extraction records available';
  }

  const recentExtractions = historicalData.extractionHistory.slice(0, 3);
  const successCount = recentExtractions.filter((r) => r.status === 'applied').length;
  const successRate = Math.round((successCount / recentExtractions.length) * 100);

  return `Based on ${recentExtractions.length} recent extractions:
- Historical success rate: ${successRate}%
- Recent patterns: ${historicalData.canvasPatterns?.slice(0, 3).join(', ') || 'None'}`;
}
