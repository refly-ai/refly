import type { WorkflowVariable } from './variable-extraction.dto';

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
