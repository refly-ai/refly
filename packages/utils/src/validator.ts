import { DynamicConfigItem } from '@refly/openapi-schema';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateConfig = (
  obj: Record<string, unknown>,
  items: DynamicConfigItem[],
): ValidationResult => {
  const errors: string[] = [];

  // Validate each config item
  for (const item of items) {
    const value = obj[item.key];

    // Check required fields
    if (item.required && (value === undefined || value === null || value === '')) {
      errors.push(`Required field '${item.key}' is missing or empty`);
      continue;
    }

    // Skip validation for optional fields that are not provided
    if (!item.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation based on input mode
    switch (item.inputMode) {
      case 'text':
      case 'textarea':
        if (typeof value !== 'string') {
          errors.push(`Field '${item.key}' must be a string, got ${typeof value}`);
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push(`Field '${item.key}' must be a number, got ${typeof value}`);
        } else {
          // Validate number constraints
          if (item.inputProps?.min !== undefined && value < item.inputProps.min) {
            errors.push(
              `Field '${item.key}' must be at least ${item.inputProps.min}, got ${value}`,
            );
          }
          if (item.inputProps?.max !== undefined && value > item.inputProps.max) {
            errors.push(`Field '${item.key}' must be at most ${item.inputProps.max}, got ${value}`);
          }
          if (item.inputProps?.step !== undefined) {
            const remainder = (value - (item.inputProps.min ?? 0)) % item.inputProps.step;
            if (Math.abs(remainder) > 0.0001) {
              // Allow for floating point precision
              errors.push(`Field '${item.key}' must be a multiple of ${item.inputProps.step}`);
            }
          }
        }
        break;

      case 'select':
      case 'radio':
        if (typeof value !== 'string') {
          errors.push(`Field '${item.key}' must be a string, got ${typeof value}`);
        } else if (item.options?.length) {
          const validValues = item.options.map((option) => option.value);
          if (!validValues.includes(value)) {
            errors.push(`Field '${item.key}' must be one of: ${validValues.join(', ')}`);
          }
        }
        break;

      case 'multiSelect':
        if (!Array.isArray(value)) {
          errors.push(`Field '${item.key}' must be an array, got ${typeof value}`);
        } else if (item.options?.length) {
          const validValues = item.options.map((option) => option.value);
          const invalidValues = (value as string[]).filter((v) => !validValues.includes(v));
          if (invalidValues.length > 0) {
            errors.push(`Field '${item.key}' contains invalid values: ${invalidValues.join(', ')}`);
          }
        }
        break;

      case 'switch':
        if (typeof value !== 'boolean') {
          errors.push(`Field '${item.key}' must be a boolean, got ${typeof value}`);
        }
        break;

      default:
        errors.push(`Unknown input mode '${item.inputMode}' for field '${item.key}'`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
