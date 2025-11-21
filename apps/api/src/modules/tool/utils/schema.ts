/**
 * Schema utilities
 * Handles JSON schema parsing, validation, and conversion to Zod schemas
 */

import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import type { JsonSchema, SchemaProperty } from '@refly/openapi-schema';
import type { z } from 'zod';

/**
 * Convert JSON schema to Zod schema
 * Uses @dmitryrechkin/json-schema-to-zod for runtime conversion
 * @param schema - JSON schema object
 * @returns Zod schema for validation
 */
export function jsonSchemaToZod(schema: JsonSchema): z.ZodTypeAny {
  if (schema.type !== 'object') {
    throw new Error('Root schema must be of type "object"');
  }

  try {
    return JSONSchemaToZod.convert(schema);
  } catch (error) {
    throw new Error(`Failed to convert JSON schema to Zod: ${(error as Error).message}`);
  }
}

/**
 * Parse JSON schema string to object
 * @param schemaJson - JSON schema as string
 * @returns Parsed JSON schema object
 */
export function parseJsonSchema(schemaJson: string): JsonSchema {
  try {
    const schema = JSON.parse(schemaJson);

    if (typeof schema !== 'object' || schema === null) {
      throw new Error('Schema must be an object');
    }

    // Don't enforce object type here - let the caller decide validation
    return schema as JsonSchema;
  } catch (error) {
    throw new Error(`Invalid JSON schema: ${(error as Error).message}`);
  }
}

/**
 * Validate JSON schema structure
 * @param schema - JSON schema to validate
 * @returns True if valid
 * @throws Error if invalid
 */
export function validateJsonSchema(schema: JsonSchema): boolean {
  if (schema.type !== 'object') {
    throw new Error('Root schema must be of type "object"');
  }

  if (!schema.properties || typeof schema.properties !== 'object') {
    throw new Error('Schema must have properties field');
  }

  // Basic validation - detailed validation is handled by the converter
  return true;
}

/**
 * Build Zod schema from JSON schema string
 * Combines parsing, validation, and conversion in one function
 * @param schemaJson - JSON schema as string
 * @returns Zod schema for validation
 * @throws Error if schema is invalid or conversion fails
 */
export function buildSchema(schemaJson: string): z.ZodTypeAny {
  // Parse JSON schema
  const jsonSchema = parseJsonSchema(schemaJson);

  // Validate schema structure
  validateJsonSchema(jsonSchema);

  // Convert to Zod schema
  return jsonSchemaToZod(jsonSchema);
}

/**
 * Fill default values from JSON schema into input parameters
 * Recursively processes nested objects and arrays
 * @param params - Input parameters object
 * @param schema - JSON schema with default values
 * @returns Parameters with default values filled in
 */
export function fillDefaultValues(
  params: Record<string, unknown>,
  schema: JsonSchema | SchemaProperty,
): Record<string, unknown> {
  const properties = schema.properties;

  if (!properties) {
    return params;
  }

  const result = { ...params };

  // Process each property in the schema
  for (const [key, propertySchema] of Object.entries(properties)) {
    // If value is undefined or null, apply default if exists
    if (result[key] === undefined || result[key] === null) {
      if ('default' in propertySchema) {
        const defaultValue = propertySchema.default;
        // If the default is a partial object, also fill nested defaults
        result[key] =
          propertySchema.type === 'object' && defaultValue && typeof defaultValue === 'object'
            ? fillDefaultValues(defaultValue as Record<string, unknown>, propertySchema)
            : defaultValue;
      } else if (propertySchema.type === 'object' && propertySchema.properties) {
        const filledObject = fillDefaultValues({}, propertySchema);
        if (Object.keys(filledObject).length > 0) {
          result[key] = filledObject;
        }
      }
      continue;
    }

    // Recursively process nested objects
    if (
      propertySchema.type === 'object' &&
      typeof result[key] === 'object' &&
      result[key] !== null
    ) {
      result[key] = fillDefaultValues(result[key] as Record<string, unknown>, propertySchema);
      continue;
    }

    // Process arrays
    if (propertySchema.type === 'array' && Array.isArray(result[key])) {
      const itemsSchema = propertySchema.items;
      if (itemsSchema && itemsSchema.type === 'object') {
        // Handle arrays of objects - recursively fill defaults
        result[key] = (result[key] as unknown[]).map((item) => {
          if (typeof item === 'object' && item !== null) {
            return fillDefaultValues(item as Record<string, unknown>, itemsSchema);
          }
          return item;
        });
        // Arrays of primitives and nested arrays don't need default value filling
        // as they don't have properties with defaults
      }
    }
  }

  return result;
}
