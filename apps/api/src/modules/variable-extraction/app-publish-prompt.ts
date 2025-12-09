import {
  WorkflowVariable,
  CanvasContext,
  HistoricalData,
  CanvasContentItem,
} from './variable-extraction.dto';

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
  input?: {
    originalQuery?: string;
    query?: string;
    [key: string]: any;
  };
}

interface CanvasDataInput {
  nodes: CanvasNode[];
  contentItems: CanvasContentItem[];
  skillResponses: CanvasNode[];
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
  const nodesText = buildNodesText(canvasData.skillResponses);

  // Filter variables to only include those actually used in canvas nodes
  const usedVariables = canvasData?.variables || [];
  const variablesText = buildVariablesText(usedVariables);

  const canvasContextText = buildCanvasContextText(canvasContext);
  const historicalContext = historicalData ? buildHistoricalContext(historicalData) : '';

  return `# AI Workflow APP Template Generation Expert

You are a professional workflow analysis expert responsible for generating user-friendly natural language templates for APP publishing. Your goal is to create intuitive, clear templates that help users understand and use the workflow effectively.

# 🚨 CRITICAL: Variable Name Exact Matching Rule

**THIS IS THE MOST IMPORTANT RULE - FAILURE IS NOT ACCEPTABLE**

The variable names in template.content MUST be EXACTLY the same as provided in the variables list below.

**Exact Matching Requirements**:
- ✅ Character-by-character identical
- ✅ Case-sensitive matching
- ✅ No typos, no modifications
- ✅ Preserve underscores, hyphens, numbers
- ✅ Preserve special characters in variable names

**Example of CORRECT matching**:
Variables provided: [target_job_description, preferred_language]
Template: "...{{target_job_description}}...{{preferred_language}}..."
✅ CORRECT - Names match exactly

**Example of WRONG matching**:
Variables provided: [target_job_description, preferred_language]
Template: "...{{target_job}}...{{language}}..."
❌ WRONG - Names are shortened/modified

**Example of WRONG case**:
Variables provided: [targetJob, preferredLanguage]
Template: "...{{TargetJob}}...{{PreferredLanguage}}..."
❌ WRONG - Case is different

**Example of WRONG typo**:
Variables provided: [weather_condition, content_style]
Template: "...{{wheather_condition}}...{{content_sytle}}..."
❌ WRONG - Has typos (wheather, sytle)

## Input Context

### Workflow Information
${canvasData.title ? `- Title: ${canvasData.title}` : ''}
${canvasData.description ? `- Description: ${canvasData.description}` : ''}

### Canvas Nodes and Prompts
${nodesText}

### Workflow Variables (${usedVariables?.length || 0} total):

${
  usedVariables?.length
    ? `**⚠️ CRITICAL: Use EXACT names below in template.content - NO modifications allowed**

${buildVariablesTableText(usedVariables)}

**Available Variable Names**

YOU MUST USE THESE EXACT NAMES - NO MODIFICATIONS ALLOWED.
Copy these names EXACTLY into your template.content:
${usedVariables.map((v) => `- {{${v.name}}}`).join('\n')}

**Copy-Paste Reference** (for exact matching):
${usedVariables.map((v) => `{{${v.name}}}`).join(', ')}

**Detailed Variable Information**:
${variablesText}`
    : '- No existing variables'
}

### Workflow Context
${canvasContextText}

${historicalContext ? `### Historical Learning Context\n${historicalContext}` : ''}

## Core Requirements

### 1. Language Consistency (CRITICAL)

**Language Determination Rule (CRITICAL)**:
The output language MUST be determined based on the following sections in priority order:
1. **Workflow Information** (Title and Description) - PRIMARY source
2. **Canvas Nodes and Prompts** - PRIMARY source
3. **Workflow Context** - SECONDARY source

**IMPORTANT**: Variables section language should be IGNORED when determining output language. Variable names and descriptions may be in different languages, but this does NOT affect the template language.

**Language Mapping Rules**:
- If Workflow Information, Canvas Nodes, or Workflow Context are in Chinese → Generate Chinese template
- If Workflow Information, Canvas Nodes, or Workflow Context are in English → Generate English template
- If mixed languages exist → Follow the primary language (the language used in most of the content)
- **DO NOT** use Variables section language as a reference for template language

**Examples**:
- ✅ Correct: Workflow Info in Chinese, Variables in English → Generate Chinese template
- ✅ Correct: Canvas Nodes in English, Variables in Chinese → Generate English template
- ❌ Wrong: Using Variables language to determine template language

### 2. Variable Integration (CRITICAL)

**MANDATORY VARIABLE INCLUSION RULE (CRITICAL)**:
- **ALL provided variables MUST appear in the output template.content as {{variable_name}} placeholders. NO EXCEPTIONS.**
- **EVERY variable in the list above MUST be included, even if it seems unrelated to the workflow.**
- **NO variables can be omitted under any circumstances.**

**Strict Rule**: The number of {{variable_name}} placeholders in template.content MUST exactly match the variables count above.

**ONE-TO-ONE MAPPING RULE (CRITICAL)**: Each variable must correspond to exactly ONE placeholder, and each placeholder must use a UNIQUE variable name. NO DUPLICATES allowed.

${usedVariables?.length ? `**Required**: Your template.content must contain exactly ${usedVariables.length} {{variable_name}} placeholder(s), each using a DIFFERENT variable name from the list above. **EVERY variable in the list MUST be included, even if it seems unrelated to the workflow.**` : '**Required**: Your template.content must contain ZERO {{variable_name}} placeholders.'}

**Mapping Rules**:
- ✅ Correct: ${usedVariables?.length || 0} variables = ${usedVariables?.length || 0} UNIQUE placeholders (one-to-one mapping)
- ❌ Wrong: ${usedVariables?.length || 0} variables ≠ any other number of placeholders
- ❌ Wrong: Repeating the same variable name multiple times (e.g., {{topic}} and {{topic}} again)
- ❌ Wrong: Using variable names that don't exist in the variables list above

**Example of Correct One-to-One Mapping**:
If variables are: [topic, style, format]
✅ Correct: "Create {{topic}} content in {{style}} with {{format}} format"
❌ Wrong: "Create {{topic}} content in {{topic}} style" (duplicate variable)
❌ Wrong: "Create {{topic}} content" (missing variables)

### 3. Natural Language Conversion (CRITICAL)
Transform technical descriptions into conversational, user-friendly language:
- Start with "I'll help you..." or "I'll create..."
- Explain benefits, not just features
- Use simple, everyday language
- Avoid technical jargon

**Variable Context Integration (CRITICAL)**:
- **Variable names carry important meaning** - treat them as descriptive information, not just placeholders
- When referencing variables, provide clear context about their role
- Example: Instead of "generate {{mecha}}" → use "generate {{mecha}}-style" or "generate content with {{mecha}} theme"
- Make it crystal clear what each variable represents in the workflow
- Help users understand what value they should provide for each variable

**Natural Flow Requirements**:
- **NEVER use stiff transitional phrases** that create awkward interruptions (e.g., "Although...", "Even though...", "Despite...")
- **MANDATORY**: Seamlessly integrate ALL variables into a natural, flowing narrative
- **CRITICAL RULE**: If a variable seems unrelated to the main workflow, you MUST find a natural way to connect it through language
  * Use creative language bridges: "Incorporating your {{weather}} context, I'll create {{topic}} content with {{style}} approach"
  * Examples: "Considering your {{preference}} and {{weather}} conditions, I'll generate {{topic}} content"
- The template should sound like a native speaker explaining the workflow naturally
- **NEVER omit variables** - every variable must appear in the template
- **NEVER** explain that variables are irrelevant or won't be used
  * ❌ Wrong: "Although you provided {{weather}}, it won't be used..."
  * ✅ Correct: "I'll create {{topic}} content, considering the {{weather}} context you provided"

**Clean Output Requirements (CRITICAL)**:
- **NEVER include unnecessary punctuation** like quotation marks or other decorative symbols
- Keep the text clean and professional
- Use natural language without artificial formatting symbols
- Examples:
  * ❌ BAD: Create a "special" {{style}} image (has decorative quotes)
  * ✅ GOOD: Create a {{style}}-style image (clean, clear)

**BAD Examples (NEVER do this)**:
❌ "I'll create {{content}} for you. Even though you provided {{unrelated_var}}, it won't be used in this workflow."
   (Problem: Highlights irrelevance instead of connecting it naturally)
❌ "I'll create {{topic}} content in {{style}} style."
   (Problem: Missing {{weather}} variable - ALL variables must be included)

**GOOD Examples (Natural flow with ALL variables connected through language)**:
✅ "I'll help you create {{content_type}} content focused on {{topic}} with your preferred {{style}} approach."
   (Conversational tone with variable context)
✅ "I'll create {{topic}} content in {{style}} style, incorporating the {{weather}} context you provided, and output it in {{format}} format."
   (All variables included, {{weather}} connected naturally without forced transitions)
✅ "I'll generate {{topic}} content with {{style}} approach, considering your {{preference}} and the {{weather}} conditions you specified."
   (All variables seamlessly integrated with natural language connections)

### 4. Variable Types (when variables exist)
- **string**: {{topic}}, {{style}}, {{preference}}
- **resource**: {{upload_file}}, {{document}}, {{image}}
- **option**: {{format}}, {{mode}}, {{language}}

## Output Format

${
  usedVariables?.length
    ? `**🚨 FINAL CRITICAL REMINDER: Your template.content MUST use these EXACT variable names:**

${usedVariables.map((v) => `{{${v.name}}}`).join(', ')}

**Before submitting**: Compare EACH variable name in your template.content with the list above character-by-character.`
    : ''
}

Return valid JSON only:

\`\`\`json
{
  "template": {
    "title": "Clear, action-oriented workflow title",
    "description": "Brief description of workflow purpose and benefits",
    "content": "Natural language template ${usedVariables?.length ? `with exactly ${usedVariables.length} {{variable_name}} placeholder(s) using EXACT names from the list above` : 'without any {{variable_name}} placeholders'}",
    "usageInstructions": "How to use this template in 1-2 sentences"
  }
}
\`\`\`

## Common Mistakes to AVOID

### ❌ Mistake 1: Name Abbreviation
**Variables provided**: [original_resume, target_job_description]
**Wrong Output**: "...{{resume}}...{{job_description}}..."
**Why Wrong**: Variable names are abbreviated
**Correct Output**: "...{{original_resume}}...{{target_job_description}}..."
**Rule**: Use the FULL variable name, never abbreviate

### ❌ Mistake 2: Case Change
**Variables provided**: [preferredLanguage, outputFormat]
**Wrong Output**: "...{{PreferredLanguage}}...{{output_format}}..."
**Why Wrong**: First letter capitalized in first variable, underscore changed in second
**Correct Output**: "...{{preferredLanguage}}...{{outputFormat}}..."
**Rule**: Preserve EXACT case - do not capitalize or change case

### ❌ Mistake 3: Typo
**Variables provided**: [weather_condition, content_style]
**Wrong Output**: "...{{wheather_condition}}...{{content_sytle}}..."
**Why Wrong**: "weather" misspelled as "wheather", "style" misspelled as "sytle"
**Correct Output**: "...{{weather_condition}}...{{content_style}}..."
**Rule**: Copy names character-by-character to avoid typos

### ❌ Mistake 4: Using Similar But Wrong Names
**Variables provided**: [user_input, target_format]
**Wrong Output**: "...{{user_query}}...{{output_format}}..."
**Why Wrong**: Used "user_query" instead of "user_input", "output_format" instead of "target_format"
**Correct Output**: "...{{user_input}}...{{target_format}}..."
**Rule**: Do not substitute with similar-sounding names - use EXACT names provided

### ❌ Mistake 5: Adding Extra Words
**Variables provided**: [topic, style]
**Wrong Output**: "...{{topic_name}}...{{style_type}}..."
**Why Wrong**: Added "_name" and "_type" suffixes
**Correct Output**: "...{{topic}}...{{style}}..."
**Rule**: Do not add prefixes or suffixes to variable names

### ❌ Mistake 6: Removing Underscores or Hyphens
**Variables provided**: [file_upload, content-type]
**Wrong Output**: "...{{fileupload}}...{{contenttype}}..."
**Why Wrong**: Removed underscores and hyphens
**Correct Output**: "...{{file_upload}}...{{content-type}}..."
**Rule**: Preserve ALL special characters in variable names

## Examples

### Example 1: With Variables (4 variables)
**Input**: Resume optimization workflow with 4 variables
**Output template.content**: "I'll help you create a professional resume optimized for your target job. Please provide your {{original_resume}} and the {{target_job_description}}, and I'll rewrite it in {{preferred_language}} with {{output_format}} formatting to ensure it passes ATS screening."
✅ Correct: 4 variables = 4 placeholders

### Example 2: Without Variables (0 variables)
**Input**: Travel planning workflow with 0 variables
**Output template.content**: "I'll help you create a comprehensive travel itinerary based on your preferences and requirements. I'll analyze your destination, dates, and specific needs to provide a detailed plan with accommodations, dining options, and daily activities."
✅ Correct: 0 variables = 0 placeholders

### Example 3: ERROR Case - Missing Placeholders (AVOID)
**Input**: 3 variables provided (topic, style, weather)
**Output template.content**: "I'll create {{topic}} content in {{style}} style."
❌ Wrong: 3 variables but only 2 placeholders - missing {{weather}} variable
✅ Correct: "I'll create {{topic}} content in {{style}} style, considering the {{weather}} context you provided."
   (All 3 variables included, {{weather}} connected naturally through language bridge)

### Example 4: ERROR Case - Duplicate Variables (AVOID)
**Input**: 3 variables provided (topic, style, format)
**Output template.content**: "I'll create {{topic}} content in {{topic}} style with {{format}} format."
❌ Wrong: Variable "topic" appears twice - violates one-to-one mapping rule
✅ Correct: "I'll create {{topic}} content in {{style}} style with {{format}} format."

### Example 5: Correct Case - Connecting Unrelated Variables (FOLLOW THIS)
**Input**: 3 variables provided (topic, style, weather) - weather seems unrelated to content generation
**Output template.content**: "I'll create {{topic}} content in {{style}} style, incorporating the {{weather}} context you provided."
✅ Correct: All 3 variables included, seemingly unrelated {{weather}} connected naturally through language bridge

${APP_PUBLISH_EXAMPLES}

## Validation Checklist

Before returning your response, you MUST complete this checklist:

### 🔴 CRITICAL: Variable Name Verification - HIGHEST PRIORITY

${
  usedVariables?.length
    ? usedVariables
        .map(
          (v, idx) =>
            `- [ ] Variable ${idx + 1}: "{{${v.name}}}" appears in template.content EXACTLY as written (character-by-character match)`,
        )
        .join('\n')
    : '- [ ] No variables to verify (0 variables provided)'
}

**Self-Check Questions for Variable Names**:
- [ ] Did I copy each variable name character-by-character from the "Available Variable Names" list above?
- [ ] Did I preserve the exact case (uppercase/lowercase) for each variable?
- [ ] Did I check for typos in every variable name by comparing with the original list?
- [ ] Did I avoid abbreviating or modifying any variable names?
- [ ] Did I preserve all underscores, hyphens, and special characters in variable names?
- [ ] Does each {{variable_name}} in my template match the "Copy-Paste Reference" list EXACTLY?

### Regular Validation Items:

- [ ] **LANGUAGE DETERMINATION**: Language matches Workflow Information, Canvas Nodes, or Workflow Context (NOT Variables)
  * Language determined from: Workflow Info → Canvas Nodes → Workflow Context (in priority order)
  * Variables section language is IGNORED for language determination
  * Chinese content in primary sources → Chinese output
  * English content in primary sources → English output
- [ ] **MANDATORY VARIABLE INCLUSION**: template.content placeholder count = variables count (${usedVariables?.length || 0})
  * **CRITICAL**: ALL ${usedVariables?.length || 0} variables MUST appear in template.content
  * NO variables can be omitted, even if they seem unrelated
- [ ] **ONE-TO-ONE MAPPING**: Each variable appears exactly ONCE in template.content (no duplicates)
- [ ] **UNIQUE VARIABLES**: All placeholders use DIFFERENT variable names (no repeated variable names)
- [ ] **VARIABLE CONTEXT**: Each variable is referenced with clear context about its role
  * Good: "{{mecha}}-style image" or "{{topic}}-focused content"
  * Bad: just "{{mecha}} image" or "{{topic}} content"
- [ ] **LANGUAGE BRIDGES**: All variables, including seemingly unrelated ones, are connected through natural language
  * Use creative language bridges: "incorporating {{weather}} context", "considering {{preference}}", etc.
  * Never omit variables or explain they're irrelevant
- [ ] **CLEAN OUTPUT**: No unnecessary punctuation marks like "" or "" around variables or regular text
- [ ] Template is conversational and user-friendly (sounds like natural speech)
- [ ] **NATURAL FLOW**: No stiff transitional phrases (e.g., "Although...", "Even though...", "Despite...")
- [ ] **NO IRRELEVANCE EXPLANATIONS**: Never mention that certain variables are irrelevant or won't be used
- [ ] **ALL VARIABLES INTEGRATED**: All ${usedVariables?.length || 0} variables are seamlessly integrated into a natural, flowing narrative through language bridges
- [ ] JSON is valid and complete

## Critical Reminder

**The template.content field is the MOST IMPORTANT output.** It must satisfy ALL of the following requirements:

### Mandatory Requirements (Must ALL be met):
1. **🚨 VARIABLE NAME EXACT MATCHING**: Variable names must be EXACTLY the same
   - **Character-by-character identical** - no typos, no abbreviations, no case changes
   - **Use the EXACT names** from the "Available Variable Names" list above
   - Compare each variable name in your output with the original list before submitting
   - Examples of what counts as "not exact":
     * ❌ "{{resume}}" when variable is "{{original_resume}}"
     * ❌ "{{PreferredLanguage}}" when variable is "{{preferredLanguage}}"
     * ❌ "{{wheather}}" when variable is "{{weather}}"
2. **Language Consistency**: Match the language from Workflow Information, Canvas Nodes, or Workflow Context
   - Determine language from: Workflow Info → Canvas Nodes → Workflow Context (priority order)
   - **CRITICAL**: IGNORE Variables section language when determining output language
   - Variables may be in different languages, but template language follows primary sources only
3. **MANDATORY Variable Inclusion**: Contain exactly ${usedVariables?.length || 0} {{variable_name}} placeholder(s)
   - **CRITICAL**: ALL ${usedVariables?.length || 0} variables MUST appear in template.content
   - NO variables can be omitted, even if they seem unrelated
   - Every variable in the provided list must be included
4. **ONE-TO-ONE MAPPING**: Each variable appears exactly ONCE - NO DUPLICATES
5. **UNIQUE VARIABLES**: All ${usedVariables?.length || 0} placeholders use DIFFERENT variable names
6. **Variable Context**: Provide clear context for each variable
   - Good: "{{mecha}}-style image", "{{topic}}-focused content"
   - Bad: "{{mecha}} image", "{{topic}} content"
7. **Clean Output**: NEVER use unnecessary punctuation or decorative symbols
8. **Natural Flow with Language Bridges**: Sound natural and conversational
   - NO stiff transitions (no "Although...", etc.)
   - NO irrelevance explanations (never mention unused variables)
   - **CRITICAL**: If a variable seems unrelated, use creative language bridges to connect it naturally
     * Examples: "incorporating {{weather}} context", "considering {{preference}}"
9. **Seamless Integration**: ALL variables flow naturally in the narrative through language bridges
   - Even seemingly unrelated variables must be connected through natural language
10. **Self-Contained**: The template should be clear and complete on its own

### Quality Guidelines:
- **Native Speaker Test**: Template should sound like a native speaker naturally explaining the workflow, not like a forced enumeration of variables
- **Meaningful Names**: Variable names carry semantic meaning - use them to help users understand what information they need to provide
- **Professional Tone**: Maintain a helpful, friendly, yet professional tone
- **User-Centric**: Focus on what the user will get, not just what the workflow does

### Output Format:
- Return ONLY valid JSON
- No additional text before or after the JSON
- Ensure all JSON syntax is correct

Generate your response now.`;
}

/**
 * Extract variable references from originalQuery string
 * Handles patterns like @{type=var,id=var-xxx,name=xxx}
 */
function extractVariableReferences(originalQuery: string): string[] {
  if (!originalQuery || typeof originalQuery !== 'string') {
    return [];
  }

  // Match pattern: @{type=var,id=var-xxx,name=xxx} or @{type=resource,id=r-xxx,name=xxx}
  const variablePattern = /@\{type=(?:var|resource),id=([^,]+),name=([^}]+)\}/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  match = variablePattern.exec(originalQuery);
  while (match !== null) {
    const variableName = match[2]; // Extract the name part
    if (variableName && !matches.includes(variableName)) {
      matches.push(variableName);
    }
    match = variablePattern.exec(originalQuery);
  }

  return matches;
}

/**
 * Build nodes text - format canvas nodes into readable description
 * Includes node title, type, and query content for prompt generation
 */
function buildNodesText(skillResponses: CanvasNode[]): string {
  if (!skillResponses?.length) {
    return '- No workflow nodes found';
  }

  return skillResponses
    .map((node, index) => {
      const nodeType = node?.type || 'unknown';
      const nodeTitle = node?.title || node?.data?.title || `Node ${index + 1}`;
      // Extract query from metadata.structuredData.query (used by filterUsedVariables) or metadata.query
      // Safely handle cases where node.data or metadata might be undefined
      const query =
        (node?.data as any)?.metadata?.structuredData?.query ??
        (node?.data as any)?.metadata?.query ??
        '';

      let description = `- ${nodeTitle} (${nodeType})`;
      if (query?.trim()) {
        description += `\n  Query: ${query}`;
      }

      return description;
    })
    .join('\n');
}

/**
 * Filter variables to only include those actually used in canvas nodes
 */
export function filterUsedVariables(
  variables: WorkflowVariable[],
  skillResponses: CanvasNode[],
): WorkflowVariable[] {
  if (!variables?.length || !skillResponses?.length) {
    return variables || [];
  }

  // Extract all variable references from all nodes' originalQuery fields
  const usedVariableNames = new Set<string>();

  for (const node of skillResponses) {
    const originalQuery = (node.data as any).metadata?.structuredData?.query || '';
    if (originalQuery) {
      const variableRefs = extractVariableReferences(originalQuery);
      for (const name of variableRefs) {
        usedVariableNames.add(name);
      }
    }
  }

  // Filter variables to only include those that are actually used
  return variables.filter((variable) => {
    // Check if variable name is used
    if (usedVariableNames.has(variable.name)) {
      return true;
    }

    // Check if any resource name in variable values is used
    if (variable.value && Array.isArray(variable.value)) {
      for (const valueItem of variable.value) {
        if (valueItem.type === 'resource' && valueItem.resource?.name) {
          if (usedVariableNames.has(valueItem.resource.name)) {
            return true;
          }
        }
      }
    }

    return false;
  });
}

/**
 * Build variables table text - format variables into a structured table
 */
function buildVariablesTableText(variables: WorkflowVariable[]): string {
  if (!variables?.length) {
    return '';
  }

  const tableHeader = `| # | Variable Name | Type | Description |
|---|--------------|------|-------------|`;

  const tableRows = variables
    .map((v, idx) => {
      const description = v.description || 'N/A';
      return `| ${idx + 1} | \`{{${v.name}}}\` | ${v.variableType} | ${description} |`;
    })
    .join('\n');

  return `${tableHeader}\n${tableRows}`;
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
    .join(`
      `);
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
