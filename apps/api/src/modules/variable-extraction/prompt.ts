import {
  WorkflowVariable,
  CanvasContext,
} from 'src/modules/variable-extraction/variable-extraction.dto';

/**
 * Base prompt builder - standard variable extraction mode
 * Use cases: first-time variable extraction, no special requirements
 * Purpose: provide standardized variable extraction guidance, balancing accuracy and completeness
 */
export function buildVariableExtractionPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
): string {
  return buildEnhancedPrompt(userPrompt, existingVariables, canvasContext, 'standard');
}

/**
 * Enhanced prompt builder - supports multiple modes
 * Use cases: generate specialized prompts for different business requirements
 * Purpose: provide modal prompts to improve extraction quality in specific scenarios
 */
export function buildEnhancedPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
  /**
   * Variable extraction mode, controls prompt generation strategy and focus
   * - standard: standard mode - balance accuracy and completeness, suitable for first-time variable extraction
   * - validation: validation mode - focus on variable accuracy and reasonability, for dual-path validation
   * - historical: historical mode - based on historical data learning, optimize variable naming and classification strategies
   * - consensus: consensus mode - compare multiple extraction results, generate optimal fusion solution
   */
  mode: 'standard' | 'validation' | 'historical' | 'consensus' = 'standard',
): string {
  const existingVarsText = buildExistingVariablesText(existingVariables);
  const canvasContextText = buildCanvasContextText(canvasContext);

  let modeSpecificInstructions = '';

  switch (mode) {
    case 'validation':
      modeSpecificInstructions = buildValidationInstructions();
      break;
    case 'historical':
      modeSpecificInstructions = buildHistoricalInstructions();
      break;
    case 'consensus':
      modeSpecificInstructions = buildConsensusInstructions();
      break;
    default:
      modeSpecificInstructions = buildStandardInstructions();
  }

  return `# AI Workflow Variable Intelligent Extraction Expert

You are a professional workflow analysis expert responsible for intelligently extracting parameterizable variables from users' natural language input to build efficient workflow templates.

## Core Tasks
1. **Precise Identification**: Analyze user input, identify all variable parameters
2. **Intelligent Classification**: Categorize parameters into string/resource/option three types
3. **Variable Reuse**: Detect and reuse existing variables, avoid duplicate creation
4. **Template Generation**: Generate processedPrompt template with placeholders

## Input Context

### User Original Input
\`\`\`
${userPrompt}
\`\`\`

### Existing Variable Library
${existingVarsText}

### Workflow Context
${canvasContextText}

${modeSpecificInstructions}

## Variable Type Definitions

### 1. string (Text Variable)
- **Purpose**: Pure text content, configuration parameters, description information
- **Examples**: Topic, title, requirements, style, language, etc.
- **Naming**: topic, title, style, language, requirement

### 2. resource (Resource Variable) 
- **Purpose**: Files, documents, images that users need to upload
- **Examples**: Resume files, reference documents, image materials, etc.
- **Naming**: resume_file, reference_doc, source_image

### 3. option (Option Variable)
- **Purpose**: Predefined selection items, enumeration values
- **Examples**: Format selection, mode selection, level selection, etc.
- **Naming**: output_format, processing_mode, difficulty_level

## Intelligent Analysis Process

### Step 1: Intent Understanding
- Analyze user's core goals and expected output
- Identify task type and complexity level

### Step 2: Entity Extraction
- Scan specific values and concepts in user input
- Determine which content can be parameterized
- Distinguish between fixed content and variable content

### Step 3: Variable Classification
- string: Text content that users can directly input
- resource: Files or external resources that need to be uploaded
- option: Options in limited selection sets

### Step 4: Reuse Detection
- Semantic similarity matching (threshold 0.8+)
- Pronoun detection ("this", "above", "just now")
- Context association analysis

### Step 5: Variable Naming
- Use English snake_case format
- Names should be self-explanatory and concise
- Avoid conflicts with existing variable names

### Step 6: Template Construction
- Replace extracted variable values with {{variable_name}} placeholders
- Maintain original semantic and structural integrity
- Ensure template readability and practicality

## Output Format Requirements

**Must** return standard JSON format, no format errors allowed:

\`\`\`json
{
  "analysis": {
    "userIntent": "Concise description of user intent",
    "extractionConfidence": 0.95,
    "complexityScore": 3,
    "extractedEntityCount": 5,
    "variableTypeDistribution": {
      "string": 3,
      "resource": 1, 
      "option": 1
    }
  },
  "variables": [
    {
      "name": "variable_name",
      "value": ["Specific extracted value or empty string"],
      "description": "Variable purpose description",
      "variableType": "string",
      "source": "startNode",
      "extractionReason": "Why extract this variable",
      "confidence": 0.92
    }
  ],
  "reusedVariables": [
    {
      "detectedText": "Text fragment reused in original text",
      "reusedVariableName": "Reused variable name",
      "confidence": 0.89,
      "reason": "Specific reason for reuse"
    }
  ],
  "processedPrompt": "Template string after variable replacement, using {{variable_name}} format",
  "originalPrompt": "Original user input"
}
\`\`\`

## Quality Standards
- Variable names: Clear, consistent, self-explanatory
- Variable types: Accurate classification, conforming to three type definitions
- Reuse detection: High accuracy, reduce redundant variables
- Processed template: Maintain original meaning, correct placeholder replacement`;
}

/**
 * Validation prompt - used for dual-path validation
 * Use cases: enhance direct mode LLM calls
 * Purpose: provide validation-oriented prompts, focusing on variable accuracy and reasonability
 */
export function buildValidationPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
): string {
  return buildEnhancedPrompt(userPrompt, existingVariables, canvasContext, 'validation');
}

/**
 * Historical prompt - based on historical data learning
 * Use cases: variable extraction in candidate modes, with rich historical data
 * Purpose: utilize historical successful patterns and historical variable usage habits to provide more accurate extraction results
 */
export function buildHistoricalPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
  historicalData: any,
): string {
  const basePrompt = buildEnhancedPrompt(
    userPrompt,
    existingVariables,
    canvasContext,
    'historical',
  );
  const historicalContext = buildHistoricalContext(historicalData);

  return `${basePrompt}

## Historical Learning Context
${historicalContext}

Please provide more accurate variable extraction results based on historical successful patterns and historical variable usage habits.`;
}

/**
 * Consensus generation prompt - fuse multiple extraction results
 * Use cases: enhance dual-path results fusion in direct mode
 * Purpose: compare and fuse two different variable extraction results to generate the optimal consensus solution
 */
export function buildConsensusPrompt(primaryResult: any, validationResult: any): string {
  return `# Variable Extraction Result Consensus Generation Expert

You are a professional variable extraction result analysis expert responsible for comparing and fusing two different variable extraction results to generate the optimal consensus solution.

## Input Results

### Primary Result
\`\`\`json
${JSON.stringify(primaryResult.variables, null, 2)}
\`\`\`

### Validation Result
\`\`\`json
${JSON.stringify(validationResult.variables, null, 2)}
\`\`\`

## Consensus Generation Requirements

1. **Quality Priority**: Select variable definitions with higher confidence and clearer descriptions
2. **Smart Merging**: Merge effective information from both results, avoid duplication
3. **Consistency Guarantee**: Ensure final results are logically consistent
4. **Reuse Optimization**: Prioritize effective reuse suggestions

## Analysis Dimensions

- **Variable Completeness**: Check if all necessary parameters are covered
- **Naming Conformity**: Ensure variable names conform to naming conventions
- **Type Accuracy**: Verify if variable type classification is reasonable
- **Description Clarity**: Evaluate the accuracy and understandability of variable descriptions

## Output Format

Return fused standard JSON format:

\`\`\`json
{
  "variables": [
    {
      "name": "variable_name",
      "value": ["Specific value"],
      "description": "Variable purpose description",
      "variableType": "string",
      "source": "startNode"
    }
  ],
  "reusedVariables": [
    {
      "detectedText": "Text fragment reused in original text",
      "reusedVariableName": "Reused variable name",
      "confidence": 0.89,
      "reason": "Specific reason for reuse"
    }
  ],
  "consensusReason": "Why choose this fusion solution",
  "qualityScore": 0.95
}
\`\`\``;
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
      const value = Array.isArray(v.value) ? v.value.join(', ') : v.value;
      return `- ${v.name} (${v.variableType}): ${v.description} [Current value: ${value || 'Empty'}]`;
    })
    .join('\n');
}

/**
 * Build canvas context text - internal utility function
 * Purpose: format canvas context information into structured text description
 */
function buildCanvasContextText(canvasContext: CanvasContext): string {
  const {
    nodeCount = 0,
    complexity = 0,
    resourceCount = 0,
    workflowType = 'Generic Workflow',
    primarySkills = ['Content Generation'],
    lastExtractionTime,
    recentVariablePatterns = [],
  } = canvasContext;

  let contextText = `- Canvas Nodes: ${nodeCount}
- Workflow Type: ${workflowType}
- Primary Skills: ${Array.isArray(primarySkills) ? primarySkills.join(', ') : primarySkills}
- Complexity Score: ${complexity}/100
- Resource Count: ${resourceCount}
`;

  if (lastExtractionTime) {
    contextText += `\n- Last Extraction Time: ${new Date(lastExtractionTime).toLocaleString()}`;
  }

  if (recentVariablePatterns.length > 0) {
    contextText += `\n- Recent Variable Patterns: ${recentVariablePatterns.slice(0, 5).join(', ')}`;
  }

  return contextText;
}

/**
 * Build historical context - internal utility function
 * Purpose: analyze historical data and generate structured historical learning context
 */
function buildHistoricalContext(historicalData: any): string {
  if (
    !historicalData ||
    !historicalData.extractionHistory ||
    historicalData.extractionHistory.length === 0
  ) {
    return 'No historical extraction records, standard extraction strategy will be used';
  }

  const recentExtractions = historicalData.extractionHistory.slice(0, 5);
  const variableTypes = new Map<string, number>();
  const commonPatterns = new Set<string>();
  const successRates = new Map<string, number>();

  for (const record of recentExtractions) {
    try {
      const variables = JSON.parse(record.extractedVariables);
      for (const variable of variables) {
        // Count variable type distribution
        const type = variable.variableType || 'unknown';
        variableTypes.set(type, (variableTypes.get(type) || 0) + 1);

        // Collect common patterns
        if (variable.description) {
          commonPatterns.add(variable.description);
        }
      }

      // Count success rate
      const status = record.status || 'unknown';
      successRates.set(status, (successRates.get(status) || 0) + 1);
    } catch {
      // Ignore records with parsing errors
    }
  }

  // Build historical context description
  const typeDistribution = Array.from(variableTypes.entries())
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  const patternList = Array.from(commonPatterns).slice(0, 3).join('、');

  const successRate = successRates.get('applied') || 0;
  const totalRecords = recentExtractions.length;
  const successPercentage = totalRecords > 0 ? Math.round((successRate / totalRecords) * 100) : 0;

  return `Based on ${historicalData.extractionHistory.length} historical extraction experiences:
- Variable type distribution: ${typeDistribution}
- Common patterns: ${patternList || 'No specific patterns'}
- Last extraction time: ${recentExtractions[0]?.createdAt?.toLocaleDateString() || 'Unknown'}
- Historical success rate: ${successPercentage}% (${successRate}/${totalRecords})
- Recent extraction records: ${recentExtractions.length} records`;
}

/**
 * Build standard instructions - internal utility function
 * Purpose: generate specific guidance for standard extraction mode
 */
function buildStandardInstructions(): string {
  return `## Standard Extraction Mode
- Use standard quality assessment standards
- Balance accuracy and completeness
- Prioritize user input clarity`;
}

/**
 * Build validation instructions - internal utility function
 * Purpose: generate specific guidance for validation extraction mode
 */
function buildValidationInstructions(): string {
  return `## Validation Extraction Mode
- Focus on variable accuracy and reasonability
- Verify variable type classification correctness
- Check variable naming consistency
- Ensure reuse detection accuracy`;
}

/**
 * Build historical instructions - internal utility function
 * Purpose: generate specific guidance for historical learning mode
 */
function buildHistoricalInstructions(): string {
  return `## Historical Learning Mode
- Extract based on historical successful patterns
- Learn user's variable usage preferences
- Optimize variable naming and classification strategies
- Improve reuse detection accuracy`;
}

/**
 * Build consensus instructions - internal utility function
 * Purpose: generate specific guidance for consensus generation mode
 */
function buildConsensusInstructions(): string {
  return `## Consensus Generation Mode
- Compare quality of multiple extraction results
- Select the optimal variable definition
- Merge effective reuse suggestions
- Ensure consistency and completeness of the result`;
}
