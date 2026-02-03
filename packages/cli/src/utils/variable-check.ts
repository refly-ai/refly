/**
 * Variable check utilities for workflow and skill execution.
 * Provides validation of required variables and generation of recoverable error payloads.
 */

import type { SuggestedFix } from './formatter.js';

/**
 * Variable definition from workflow or skill schema
 */
export interface VariableDefinition {
  variableId?: string;
  name: string;
  variableType?: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  isSingle?: boolean;
  resourceTypes?: string[];
}

/**
 * Result of variable validation check
 */
export interface CheckResult {
  valid: boolean;
  missing: VariableDefinition[];
  suggestedInput: Record<string, unknown>;
}

/**
 * Check if all required variables are provided.
 * Returns which variables are missing and a suggested input object.
 *
 * @param definitions - Variable definitions from workflow/skill
 * @param providedInput - Input provided by user (key-value object)
 * @returns CheckResult with validation status and missing variables
 */
export function checkRequiredVariables(
  definitions: VariableDefinition[],
  providedInput: Record<string, unknown>,
): CheckResult {
  const missing: VariableDefinition[] = [];
  const suggestedInput: Record<string, unknown> = { ...providedInput };

  for (const def of definitions) {
    if (!def.required) continue;

    const key = def.name;
    const hasValue =
      key in providedInput && providedInput[key] !== undefined && providedInput[key] !== null;

    if (!hasValue) {
      missing.push(def);
      // Add placeholder or default to suggested input
      if (def.default !== undefined) {
        suggestedInput[key] = def.default;
      } else {
        suggestedInput[key] = '<value>';
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    suggestedInput,
  };
}

/**
 * Build a recoverable error payload for missing variables.
 * The error includes all information needed for an agent to retry with correct input.
 *
 * @param commandType - 'workflow' or 'skill'
 * @param targetId - The workflow/skill ID
 * @param targetName - Optional display name
 * @param result - CheckResult from checkRequiredVariables
 * @returns Error payload suitable for fail()
 */
export function buildMissingVariablesError(
  commandType: 'workflow' | 'skill',
  targetId: string,
  targetName: string | undefined,
  result: CheckResult,
): {
  code: string;
  message: string;
  details: Record<string, unknown>;
  hint: string;
  suggestedFix: SuggestedFix;
  recoverable: true;
} {
  const displayName = targetName ? `"${targetName}"` : targetId;

  // Build suggested command based on command type
  const inputJson = JSON.stringify(result.suggestedInput);
  const suggestedCommand =
    commandType === 'workflow'
      ? `refly workflow run ${targetId} --input '${inputJson}'`
      : `refly skill run --name <name> --input '${inputJson}'`;

  return {
    code: 'MISSING_VARIABLES',
    message: `Missing required variables for ${commandType} ${displayName}`,
    details: {
      missingVariables: result.missing.map((v) => ({
        name: v.name,
        type: v.variableType || 'string',
        required: true,
        default: v.default,
        description: v.description,
      })),
      suggestedInput: result.suggestedInput,
      suggestedCommand,
    },
    hint: 'Provide the missing variables via --input. See suggestedInput for the expected format.',
    suggestedFix: {
      field: '--input',
      format: 'json-object',
      example: inputJson,
    },
    recoverable: true,
  };
}

/**
 * Convert workflow variables array to a simple key-value object.
 * Used to check user-provided input against variable definitions.
 *
 * @param variables - Array of workflow variables with values
 * @returns Simple key-value object
 */
export function variablesToObject(
  variables: Array<{ name: string; value?: unknown[] }>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const v of variables) {
    if (!v.value || v.value.length === 0) continue;

    // Extract the actual value from the array format
    const firstValue = v.value[0];
    if (typeof firstValue === 'object' && firstValue !== null) {
      // Handle resource type: { type: 'resource', resource: { fileId: '...' } }
      if ('resource' in firstValue && typeof firstValue.resource === 'object') {
        result[v.name] = firstValue;
      }
      // Handle text type: { type: 'text', text: '...' }
      else if ('text' in firstValue) {
        result[v.name] = (firstValue as { text: string }).text;
      } else {
        result[v.name] = firstValue;
      }
    } else {
      result[v.name] = firstValue;
    }
  }

  return result;
}
