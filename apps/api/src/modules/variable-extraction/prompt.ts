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

  return `# AI Workflow Variable Intelligent Extraction Expert

## Mission Statement
Transform user prompts into structured variable templates while maintaining semantic integrity, enforcing strict quantity controls, and extracting ONLY the most essential variables that capture the user's main intent.

## Core Tasks
1. **Precise Identification**: Analyze user input, identify ONLY core variable parameters that represent the PRIMARY INTENT of the user's request
2. **Quantity Control**: Strictly limit each variable type to maximum 10 variables (string ≤ 10, resource ≤ 10, option ≤ 10)
3. **Minimal Extraction**: Follow the examples in the reference materials - extract as FEW variables as possible while preserving workflow functionality
4. **Intelligent Classification**: Categorize parameters into string/resource/option three types
5. **Variable Reuse**: Mandatory check and reuse existing variables before creating new ones
6. **Template Generation**: Generate processedPrompt template with {{variable_name}} placeholders

## Input Context

### User Original Input
\`\`\`
${userPrompt}
\`\`\`

### Canvas Context
${canvasContextText}

### Existing Variables
${existingVarsText}

### Historical Context
${historicalContextText}

## Variable Type Definitions & Quantity Limits

### CRITICAL RULE: Variable Quantity Control & Minimalism
- **Maximum Limits**: Each variable type should NOT exceed 10 variables
  - string variables: Maximum 10
  - resource variables: Maximum 10  
  - option variables: Maximum 10
- **MINIMAL EXTRACTION PRINCIPLE**: Extract as FEW variables as possible - follow examples in reference materials
- **Quality over Quantity**: Extract only core, essential variables that capture the USER'S PRIMARY INTENT
- **Reuse First**: Always prioritize reusing existing variables over creating new ones
- **Focus on Impact**: Only extract variables that significantly affect workflow outcomes
- **Reference-Based**: Study the provided examples carefully - they demonstrate optimal variable extraction patterns

### 1. string (Text Variable)
- **Purpose**: Pure text content, configuration parameters, description information
- **Examples**: Topic, title, requirements, style, language, etc.
- **Naming**: topic, title, style, language, requirement
- **Limit**: Maximum 10 string variables per extraction

### 2. resource (Resource Variable)
- **Purpose**: Files, documents, images that users need to upload
- **Examples**: Resume files, reference documents, image materials, etc.
- **Naming**: resume_file, reference_doc, source_image
- **Limit**: Maximum 10 resource variables per extraction
- **DETECTION PATTERNS** - Generate \`variableType: "resource"\` when user mentions:
  - File upload keywords: "upload", "attach", "provide file", "submit document"
  - Document types: "PDF", "CSV", "Excel", "Word", "spreadsheet", "document"
  - Media types: "image", "photo", "picture", "video", "audio", "screenshot"
  - Analysis patterns: "analyze the file", "based on the uploaded", "from the document"
  - User input patterns: "user provides a file", "user uploads", "input file"
  - Processing patterns: "process the document", "extract from file", "read the PDF"
- **IMPORTANT**: When detecting file/upload intent, create resource variable with EMPTY value:
  \`\`\`json
  {
    "name": "user_file",
    "value": [],
    "description": "File uploaded by user for analysis",
    "variableType": "resource",
    "required": true
  }
  \`\`\`
- **Required Field**: Set \`required: true\` by default (files are typically required for the workflow to function properly). Only set \`required: false\` when user explicitly indicates the file is optional (e.g., "optionally upload", "if available", "can provide")

### 3. option (Option Variable)
- **Purpose**: Predefined selection items, enumeration values
- **Examples**: Format selection, mode selection, level selection, etc.
- **Naming**: output_format, processing_mode, difficulty_level
- **Limit**: Maximum 10 option variables per extraction

## Intelligent Analysis Process

### Step 1: Intent Understanding & Reference Study
- **FIRST**: Study the provided examples to understand optimal variable extraction patterns
- Analyze user's core goals and expected output
- Identify task type and complexity level
- **KEY**: Focus on the PRIMARY INTENT - what is the user's main goal?

### Step 2: Minimal Entity Extraction
- Scan specific values and concepts in user input
- **CRITICAL**: Only extract variables that represent the CORE ESSENCE of the user's request
- Determine which content can be parameterized BUT prioritize minimalism
- Distinguish between fixed content and variable content
- **Reference Check**: Compare with examples - are you extracting similar quantities of variables?

### Step 3: Variable Classification
- string: Text content that users can directly input
- resource: Files or external resources that need to be uploaded
- option: Options in limited selection sets

### Step 4: Reuse Detection & Minimalist Validation
- **Mandatory Reuse Check**: Before creating any new variable, check existing variables for reuse possibilities
- Semantic similarity matching (threshold 0.8+)
- Pronoun detection ("this", "above", "just now")  
- Context association analysis
- **Quantity Validation**: Ensure each variable type stays within 10-variable limit
- **Minimalist Check**: Are you extracting FEWER variables than the maximum? (Examples typically show 3-6 variables total)
- **Primary Intent Check**: Does each variable directly support the user's main goal?
- **Prioritization**: If approaching limits, prioritize most impactful variables

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
    "userIntent": "Brief description of what the user wants to accomplish",
    "extractionConfidence": 0.85,
    "complexityScore": 0.6,
    "extractedEntityCount": 3,
    "variableTypeDistribution": {
      "string": 3,
      "resource": 1, 
      "option": 1
    },
    "quantityValidation": {
      "stringWithinLimit": true,
      "resourceWithinLimit": true,
      "optionWithinLimit": true,
      "totalVariablesCount": 5
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
      "required": true,
      "source": "startNode",
      "extractionReason": "User specified project name in prompt",
      "confidence": 0.9
    },
    {
      "name": "reference_document",
      "value": [],
      "description": "Document uploaded by user for reference",
      "variableType": "resource",
      "required": true,
      "source": "startNode",
      "extractionReason": "User mentioned uploading a document for analysis",
      "confidence": 0.85
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
- **For resource variables**: Use \`{"type": "resource", "resource": {"name": "file_name", "fileType": "document", "storageKey": ""}}\` OR empty array \`[]\` for user-uploaded files
- **For option variables**: Use \`{"type": "text", "text": "selected_option"}\`

### Required Field
Each variable should include a \`required\` field (boolean):
- **Default to \`true\`** for all variable types (user input is typically necessary for workflow)
- Set \`required: false\` only when user explicitly indicates optional input (e.g., "optionally", "if available", "can provide", "optional")

## Quality Standards & Validation Checklist

### Variable Quantity Control ✓
- [ ] String variables ≤ 10 (PREFER much fewer - examples show 2-5 typically)
- [ ] Resource variables ≤ 10 (PREFER much fewer - examples show 0-2 typically)
- [ ] Option variables ≤ 10 (PREFER much fewer - examples show 0-3 typically)
- [ ] Total variables count verified and justified (TARGET: 3-6 variables total)
- [ ] **Examples Reference Check**: Variable count similar to reference examples

### Variable Quality & Minimalism ✓
- [ ] Variable names: Clear, consistent, self-explanatory (snake_case format)
- [ ] Variable types: Accurate classification, conforming to three type definitions
- [ ] Reuse detection: High accuracy, reduce redundant variables
- [ ] **Primary Intent Focus**: Only variables that capture the user's MAIN GOAL
- [ ] **Minimalist Principle**: Extracted as FEW variables as possible while preserving functionality
- [ ] **Examples Compliance**: Extraction pattern matches reference examples

### Template Quality ✓
- [ ] Processed template: Maintain original meaning, correct placeholder replacement
- [ ] All variables properly referenced in template with {{variable_name}} format
- [ ] Template readability and semantic integrity preserved

### Extraction Validation ✓
- [ ] Each extracted variable has clear justification for its necessity
- [ ] Existing variables checked for reuse before creating new ones
- [ ] Variable descriptions are precise and actionable

${VARIABLE_EXTRACTION_EXAMPLES}

## Key Learning Points from Examples - STUDY THESE CAREFULLY

### **MANDATORY REFERENCE ANALYSIS** - Study Each Example Pattern:

1. **Quantity Patterns**: 
   - Product Hunt example: 4 variables (target_date, date_content, generate_content, email_to)
   - Travel Planning complex: 8 variables (destination, dates, departure_city, goal, accommodation, food, pace, daily_routes)
   - Travel Planning simple: 6 variables (destination, dates, duration_days, budget, accommodation, activities)
   - Writing task: 5 variables (topic, platform, audience, length, tone)
   - Video creation: 5 variables (topic, duration, style, music, subtitle)
   - Data analysis: 4 variables (data_file, timeframe, metrics, deliverable)
   - Health plan: 5 variables (goal, diet, exercise, frequency, duration)

2. **Primary Intent Focus**: Each example extracts variables that directly support the MAIN GOAL:
   - Travel planning → destination, dates, accommodation, activities
   - Content creation → topic, platform, audience, format requirements
   - Data analysis → data source, timeframe, metrics, output format

3. **Minimalist Principle**: Examples show 4-8 variables total, NOT 30 variables
4. **Variable Naming**: Use descriptive English names in snake_case format (e.g., departure_city, daily_routes, target_date, email_to)
5. **Type Classification**: 
   - string: Most common for text content, preferences, descriptions (e.g., destination, dates, goal)
   - resource: For files, data sources, uploads (e.g., data_file, resume_file)
   - option: For limited choices, style preferences (e.g., tone, style)
6. **Template Construction**: Replace specific values with {{variable_name}} placeholders while maintaining semantic meaning
7. **Context Preservation**: Keep the original intent and structure of the user's request
8. **Reuse Strategy**: Look for opportunities to reuse variables across different contexts (e.g., "destination" can be reused for different travel scenarios)

### **CRITICAL SUCCESS METRIC**: Your extraction should match these example patterns in variable count and focus on primary intent

## Final Validation Reminder - CRITICAL CHECKS
Before submitting extraction results, verify:
- ✅ **EXAMPLES REFERENCE**: Variable count matches reference examples (typically 4-8 variables total)
- ✅ **PRIMARY INTENT FOCUS**: Each variable directly supports the user's main goal
- ✅ Each variable type count ≤ 10 (MANDATORY LIMIT, but aim for much fewer)
- ✅ Existing variables checked for reuse (MANDATORY CHECK)
- ✅ **MINIMALIST PRINCIPLE**: Extracted as FEW variables as possible while preserving functionality
- ✅ All variables properly integrated into processedPrompt template
- ✅ JSON format is valid and complete
- ✅ quantityValidation fields accurately reflect variable counts

## Extraction Success Criteria - MANDATORY STANDARDS
A successful extraction MUST:
1. **Follow Reference Examples**: Variable count and pattern similar to provided examples
2. **Capture Primary Intent**: Focus only on variables that represent the user's MAIN GOAL
3. Stay within quantity limits (≤10 per variable type, but aim for 3-6 total)
4. Reuse existing variables when semantically appropriate
5. Focus on workflow-critical variables only
6. Maintain original user intent in processedPrompt
7. Provide clear, actionable variable descriptions
8. Return valid JSON with all required fields

## FINAL EXTRACTION PRINCIPLE
**LESS IS MORE**: Study the examples, extract minimal variables that capture the PRIMARY INTENT. 
Examples show 4-8 variables per scenario - this is your target range, NOT the maximum limits.

Remember: QUALITY, MINIMALISM, and REUSE over creating many variables. The best extraction captures the essence with the fewest variables.`;
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
