/**
 * Variable Extraction module configuration constants
 */

// Complexity score weights
export const COMPLEXITY_WEIGHTS = {
  NODE_COUNT: 3, // Node count weight
  EDGE_COUNT: 2, // Edge count weight
  VARIABLE_COUNT: 2, // Variable count weight
  NODE_TYPE_DIVERSITY: 5, // Node type diversity weight
  MAX_SCORE: 100, // Maximum complexity score
} as const;

// Confidence calculation weights
export const CONFIDENCE_WEIGHTS = {
  BASE_CONFIDENCE: 0.5, // Base confidence
  PER_VARIABLE_BONUS: 0.1, // Confidence bonus per variable
  PROCESSED_PROMPT_BONUS: 0.1, // Confidence bonus for processed prompt
  REUSE_BONUS: 0.05, // Confidence bonus for reused variables
  MAX_CONFIDENCE: 0.9, // Maximum confidence
} as const;

// Default values
export const DEFAULT_VALUES = {
  WORKFLOW_TYPE: 'General Workflow',
  PRIMARY_SKILLS: ['Content Generation'],
  VARIABLE_PATTERNS: [
    'Project Name',
    'Target User',
    'Feature Scope',
    'Time Requirements',
    'Quality Standards',
  ],
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NO_LLM_PROVIDER: 'No valid LLM provider found for variable extraction',
  NO_LLM_PROVIDER_VALIDATION: 'No valid LLM provider found for validation',
  NO_LLM_PROVIDER_MULTI_ROUND: 'No valid LLM provider found for multi-round extraction',
  NO_JSON_IN_RESPONSE: 'No JSON found in LLM response',
  INVALID_RESPONSE_STRUCTURE: 'Invalid response structure: missing variables array',
  FAILED_TO_APPLY_CANDIDATE: 'Failed to apply candidate record',
  FAILED_TO_UPDATE_CANVAS: 'Failed to update canvas variables',
  FAILED_TO_SAVE_CANDIDATE: 'Failed to save candidate record',
} as const;
