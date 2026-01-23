/**
 * Skill Condition Evaluator - safely evaluates condition expressions.
 * Uses expr-eval for safe expression evaluation without eval().
 */

import { Logger } from '@nestjs/common';
import { Parser } from 'expr-eval';
import { SkillExecutionError } from './skill-execution.errors';

const logger = new Logger('SkillConditionEvaluator');

export interface ConditionContext {
  /** User input for the skill execution */
  input: Record<string, unknown>;
  /** Outputs from completed dependency workflows, keyed by skillWorkflowId */
  outputs: Record<string, unknown>;
  /** Accumulated state from data mapping */
  state: Record<string, unknown>;
}

const ALLOWED_FUNCTIONS = ['abs', 'ceil', 'floor', 'round', 'min', 'max', 'length'];

/**
 * Create a configured parser instance.
 */
function createParser(): Parser {
  const parser = new Parser({
    operators: {
      logical: true,
      comparison: true,
      in: false, // Disable 'in' operator for security
      assignment: false, // Disable assignment
    },
  });

  // Only allow specific safe functions
  const functions = parser.functions as Record<string, unknown>;
  for (const fn of Object.keys(functions)) {
    if (!ALLOWED_FUNCTIONS.includes(fn)) {
      delete functions[fn];
    }
  }

  return parser;
}

/**
 * Evaluate a condition expression.
 *
 * @param condition - The condition expression to evaluate
 * @param context - The context containing input, outputs, and state
 * @returns true if condition is satisfied, false otherwise
 */
export function evaluateCondition(condition: string, context: ConditionContext): boolean {
  if (!condition || condition.trim() === '') {
    return true; // Empty condition always passes
  }

  try {
    const parser = createParser();
    const expr = parser.parse(condition);

    // Cast to any to allow dynamic context objects - expr-eval handles them at runtime
    const evalContext = {
      input: context.input ?? {},
      outputs: context.outputs ?? {},
      state: context.state ?? {},
      // Helper functions
      length: (arr: unknown) => (Array.isArray(arr) ? arr.length : 0),
      isEmpty: (val: unknown) =>
        val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0),
      isNotEmpty: (val: unknown) =>
        val !== null && val !== undefined && val !== '' && (!Array.isArray(val) || val.length > 0),
    };
    const result = expr.evaluate(evalContext as any);

    return Boolean(result);
  } catch (error) {
    logger.error(`Condition evaluation failed: ${condition}`, error);
    // Default to false on evaluation error (fail-safe)
    return false;
  }
}

/**
 * Validate a condition expression at publish time.
 * Throws if expression is invalid or uses disallowed features.
 *
 * @param condition - The condition expression to validate
 */
export function validateConditionExpression(condition: string): void {
  if (!condition || condition.trim() === '') {
    return; // Empty condition is valid
  }

  try {
    const parser = createParser();
    const expr = parser.parse(condition);

    // Get variables used in the expression
    const variables = expr.variables();
    const allowedRoots = ['input', 'outputs', 'state'];

    for (const v of variables) {
      const root = v.split('.')[0].split('[')[0];
      if (!allowedRoots.includes(root)) {
        throw new Error(
          `Disallowed variable in condition: ${v}. Only input, outputs, state are allowed.`,
        );
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid condition syntax';
    throw SkillExecutionError.conditionEvalFailed(condition, errorMessage);
  }
}

/**
 * Evaluate condition with full workflow context.
 */
export function evaluateWorkflowCondition(
  condition: string | undefined,
  userInput: Record<string, unknown>,
  dependencyOutputs: Map<string, Record<string, unknown>>,
  currentState: Record<string, unknown>,
): boolean {
  if (!condition) {
    return true;
  }

  const context: ConditionContext = {
    input: userInput,
    outputs: Object.fromEntries(dependencyOutputs),
    state: currentState,
  };

  return evaluateCondition(condition, context);
}
