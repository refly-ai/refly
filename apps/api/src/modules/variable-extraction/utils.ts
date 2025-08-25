import { COMPLEXITY_WEIGHTS, CONFIDENCE_WEIGHTS, DEFAULT_VALUES } from './constants';
import type { CanvasNode, CanvasEdge, WorkflowVariable } from './variable-extraction.dto';

/**
 * Calculate canvas complexity score
 * @param nodes Canvas nodes
 * @param edges Canvas edges
 * @param variables Workflow variables
 * @returns Complexity score 0-100
 */
export function calculateCanvasComplexity(
  nodes: CanvasNode[] = [],
  edges: CanvasEdge[] = [],
  variables: WorkflowVariable[] = [],
): number {
  if (!nodes?.length && !edges?.length && !variables?.length) {
    return 0;
  }

  let score = 0;

  // Node count score
  score += Math.min(nodes.length * COMPLEXITY_WEIGHTS.NODE_COUNT, 30);

  // Edge count score
  score += Math.min(edges.length * COMPLEXITY_WEIGHTS.EDGE_COUNT, 20);

  // Variable count score
  score += Math.min(variables.length * COMPLEXITY_WEIGHTS.VARIABLE_COUNT, 20);

  // Node type diversity score
  const nodeTypes = new Set(nodes.map((node) => node.type));
  score += Math.min(nodeTypes.size * COMPLEXITY_WEIGHTS.NODE_TYPE_DIVERSITY, 30);

  return Math.min(score, COMPLEXITY_WEIGHTS.MAX_SCORE);
}

/**
 * Detect workflow type
 * @param contentItems Content items
 * @param variables Variables
 * @returns Workflow type
 */
export function detectWorkflowType(
  contentItems: Array<{ type: string; title?: string }> = [],
  variables: WorkflowVariable[] = [],
): string {
  if (!contentItems?.length && !variables?.length) {
    return DEFAULT_VALUES.WORKFLOW_TYPE;
  }

  // Judge based on content item types
  const typeCounts = contentItems.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Judge based on variable names
  const variableNames = variables.map((v) => v.name.toLowerCase()).join(' ');

  if (
    typeCounts.startNode > 0 ||
    variableNames.includes('project') ||
    variableNames.includes('task')
  ) {
    return 'Project Management';
  }

  if (
    typeCounts.codeNode > 0 ||
    variableNames.includes('code') ||
    variableNames.includes('function')
  ) {
    return 'Code Development';
  }

  if (
    typeCounts.dataNode > 0 ||
    variableNames.includes('data') ||
    variableNames.includes('analysis')
  ) {
    return 'Data Analysis';
  }

  if (
    typeCounts.designNode > 0 ||
    variableNames.includes('design') ||
    variableNames.includes('ui')
  ) {
    return 'Design Creation';
  }

  return DEFAULT_VALUES.WORKFLOW_TYPE;
}

/**
 * Identify primary skills
 * @param contentItems Content items
 * @param variables Variables
 * @returns Primary skills list
 */
export function identifyPrimarySkills(
  contentItems: Array<{ type: string; title?: string }> = [],
  variables: WorkflowVariable[] = [],
): string[] {
  if (!contentItems?.length && !variables?.length) {
    return [...DEFAULT_VALUES.PRIMARY_SKILLS];
  }

  const skills = new Set<string>();

  // Identify skills based on content item types
  for (const item of contentItems) {
    switch (item.type) {
      case 'startNode':
        skills.add('Requirements Analysis');
        break;
      case 'codeNode':
        skills.add('Code Development');
        break;
      case 'dataNode':
        skills.add('Data Processing');
        break;
      case 'designNode':
        skills.add('Design Creation');
        break;
      case 'apiNode':
        skills.add('API Integration');
        break;
      case 'workflowNode':
        skills.add('Workflow Orchestration');
        break;
    }
  }

  // Identify skills based on variable names
  const variableNames = variables.map((v) => v.name.toLowerCase()).join(' ');

  if (variableNames.includes('prompt') || variableNames.includes('template')) {
    skills.add('Prompt Engineering');
  }

  if (variableNames.includes('api') || variableNames.includes('endpoint')) {
    skills.add('API Design');
  }

  if (variableNames.includes('database') || variableNames.includes('query')) {
    skills.add('Database Operations');
  }

  return skills.size > 0 ? Array.from(skills) : [...DEFAULT_VALUES.PRIMARY_SKILLS];
}

/**
 * Calculate confidence score
 * @param variables Variable count
 * @param hasProcessedPrompt Whether there is a processed prompt
 * @param reusedVariables Reused variable count
 * @returns Confidence score 0-1
 */
export function calculateConfidence(
  variables: number,
  hasProcessedPrompt: boolean,
  reusedVariables: number,
): number {
  let confidence = CONFIDENCE_WEIGHTS.BASE_CONFIDENCE;

  // Variable count bonus
  confidence += Math.min(variables * CONFIDENCE_WEIGHTS.PER_VARIABLE_BONUS, 0.3);

  // Processed prompt bonus
  if (hasProcessedPrompt) {
    confidence += CONFIDENCE_WEIGHTS.PROCESSED_PROMPT_BONUS;
  }

  // Reused variable bonus
  confidence += Math.min(reusedVariables * CONFIDENCE_WEIGHTS.REUSE_BONUS, 0.1);

  return Math.min(confidence, CONFIDENCE_WEIGHTS.MAX_CONFIDENCE);
}

/**
 * Generate session ID
 * @param prefix Prefix
 * @param timestamp Timestamp
 * @returns Session ID
 */
export function generateSessionId(prefix: string, timestamp: number): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * Check if candidate record is expired
 * @param expiresAt Expiration time
 * @returns Whether expired
 */
export function isCandidateRecordExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Calculate candidate record expiration time
 * @param hours Hours
 * @returns Expiration time
 */
export function calculateExpiryTime(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Validate variable extraction result
 * @param result Extraction result
 * @returns Whether valid
 */
export function validateExtractionResult(result: {
  variables: unknown[];
  processedPrompt?: string;
}): boolean {
  return (
    Array.isArray(result.variables) &&
    result.variables.length > 0 &&
    typeof result.processedPrompt === 'string' &&
    result.processedPrompt.length > 0
  );
}

/**
 * Clean and standardize variable names
 * @param name Original name
 * @returns Standardized name
 */
export function normalizeVariableName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Check if variable name is valid
 * @param name Variable name
 * @returns Whether valid
 */
export function isValidVariableName(name: string): boolean {
  const normalized = normalizeVariableName(name);
  return normalized.length > 0 && normalized.length <= 50;
}

/**
 * Generate variable description
 * @param name Variable name
 * @param context Context information
 * @returns Variable description
 */
export function generateVariableDescription(
  name: string,
  context: Record<string, unknown> = {},
): string {
  const normalizedName = name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  if (context.workflowType) {
    return `${normalizedName} for ${context.workflowType}`;
  }

  return normalizedName;
}

/**
 * Add timestamp fields to new variables
 * @param variable Variable object
 * @returns Variable object with timestamps
 */
export function addTimestampsToNewVariable(variable: WorkflowVariable): WorkflowVariable {
  const now = new Date().toISOString();
  return {
    ...variable,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Add update timestamp for updated variables
 * @param variable Variable object
 * @param existingVariable Existing variable object
 * @returns Variable object with updated timestamp
 */
export function updateTimestampForVariable(
  variable: WorkflowVariable,
  existingVariable?: WorkflowVariable,
): WorkflowVariable {
  const now = new Date().toISOString();
  return {
    ...variable,
    createdAt: existingVariable?.createdAt || now, // Keep original creation time or use current time
    updatedAt: now, // Always update modification time
  };
}

/**
 * Check if variable has substantive changes
 * @param newVariable New variable
 * @param existingVariable Existing variable
 * @returns Whether there are changes
 */
export function hasVariableChanged(
  newVariable: WorkflowVariable,
  existingVariable: WorkflowVariable,
): boolean {
  // Compare core fields, ignore timestamp fields
  const coreFields: (keyof WorkflowVariable)[] = [
    'name',
    'value',
    'description',
    'variableType',
    'source',
    'options',
  ];

  for (const field of coreFields) {
    const newValue = newVariable[field];
    const existingValue = existingVariable[field];

    // Deep comparison for array types
    if (Array.isArray(newValue) && Array.isArray(existingValue)) {
      if (newValue.length !== existingValue.length) {
        return true;
      }
      for (let i = 0; i < newValue.length; i++) {
        if (newValue[i] !== existingValue[i]) {
          return true;
        }
      }
    } else if (newValue !== existingValue) {
      return true;
    }
  }

  return false;
}
