/**
 * Schema Simplifier for Gemini Compatibility
 *
 * This module provides utilities to simplify tool schemas for Gemini models,
 * which do not support union types (oneOf/anyOf/discriminatedUnion) in function calling.
 */

import { DynamicStructuredTool, type StructuredToolInterface } from '@langchain/core/tools';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';

/**
 * JSON Schema types
 */
interface SchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: any[];
  oneOf?: SchemaProperty[];
  anyOf?: SchemaProperty[];
  allOf?: SchemaProperty[];
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  required?: string[];
  default?: any;
  [key: string]: any;
}

interface JsonSchema extends SchemaProperty {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Type guard to check if a value is a valid SchemaProperty
 */
function isValidSchemaProperty(value: unknown): value is SchemaProperty {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Simplify union types (oneOf/anyOf) in JSON schema for Gemini compatibility
 * Gemini cannot handle union types in function calling schemas
 *
 * Strategy (Type Degradation):
 * 1. For oneOf/anyOf with multiple types: Keep only the first non-null simple type
 *    - Priority: string > number/integer > boolean > object
 *    - Example: [string enum, object] -> string enum (keeps field name unchanged)
 * 2. For oneOf/anyOf with [type, null]: Keep the type and make it optional
 *    - Example: [integer, null] -> integer (optional)
 * 3. Preserve original field names to avoid parameter mapping complexity
 *
 * Benefits:
 * - Zero execution overhead (field names unchanged, no remapping needed)
 * - Simple and safe implementation
 * - Natural compatibility with existing tool execution flow
 *
 * Trade-off:
 * - Loses some flexibility (e.g., custom dimensions not available for Gemini)
 * - In practice, preset values cover 95%+ of use cases
 */
function simplifyUnionTypesForGemini(schema: JsonSchema | SchemaProperty): void {
  // Process oneOf/anyOf at current level
  if ('oneOf' in schema || 'anyOf' in schema) {
    const rawOptions = schema.oneOf || schema.anyOf;

    // Validate that options is an array
    if (!Array.isArray(rawOptions)) {
      console.warn('Invalid schema: oneOf/anyOf must be an array', { schema });
      return;
    }

    // Filter out invalid entries and validate each option is a proper SchemaProperty
    const options = rawOptions.filter((opt): opt is SchemaProperty => {
      if (!isValidSchemaProperty(opt)) {
        console.warn('Invalid schema option: expected object, got', typeof opt);
        return false;
      }
      return true;
    });

    if (options.length === 0) {
      console.warn('No valid options found in oneOf/anyOf after validation');
      return;
    }

    // Strategy 1: Find non-null simple types with priority order
    // Priority: string > number/integer > boolean
    const simpleTypePriority = ['string', 'number', 'integer', 'boolean'];

    for (const priorityType of simpleTypePriority) {
      const simpleOption = options.find(
        (opt) => (opt.type as string) === priorityType || (opt.enum && priorityType === 'string'),
      );

      if (simpleOption) {
        // Replace union with this simple type, preserving field name
        // Copy all properties from the selected option
        Object.assign(schema, simpleOption);

        // Remove union keywords
        schema.oneOf = undefined;
        schema.anyOf = undefined;

        // IMPORTANT: Recursively process the selected option's nested structures
        // The selected option may contain nested union types that need to be simplified
        if (schema.properties && typeof schema.properties === 'object') {
          for (const key in schema.properties) {
            simplifyUnionTypesForGemini(schema.properties[key]);
          }
        }
        if (schema.type === 'array' && schema.items) {
          if (typeof schema.items === 'object' && !Array.isArray(schema.items)) {
            simplifyUnionTypesForGemini(schema.items);
          }
        }

        return;
      }
    }

    // Strategy 2: If no simple type found, try object type
    const objectOption = options.find((opt) => opt.type === 'object');
    if (objectOption) {
      Object.assign(schema, objectOption);
      schema.oneOf = undefined;
      schema.anyOf = undefined;

      // IMPORTANT: Recursively process the selected option's nested structures
      if (schema.properties && typeof schema.properties === 'object') {
        for (const key in schema.properties) {
          simplifyUnionTypesForGemini(schema.properties[key]);
        }
      }
      if (schema.type === 'array' && schema.items) {
        if (typeof schema.items === 'object' && !Array.isArray(schema.items)) {
          simplifyUnionTypesForGemini(schema.items);
        }
      }

      return;
    }

    // Strategy 3: Fallback to first non-null option
    const nonNullOption = options.find((opt) => (opt.type as string) !== 'null');
    if (nonNullOption) {
      Object.assign(schema, nonNullOption);
      schema.oneOf = undefined;
      schema.anyOf = undefined;

      // IMPORTANT: Recursively process the selected option's nested structures
      if (schema.properties && typeof schema.properties === 'object') {
        for (const key in schema.properties) {
          simplifyUnionTypesForGemini(schema.properties[key]);
        }
      }
      if (schema.type === 'array' && schema.items) {
        if (typeof schema.items === 'object' && !Array.isArray(schema.items)) {
          simplifyUnionTypesForGemini(schema.items);
        }
      }
    }
  }

  // Recursively process nested structures
  if (schema.properties && typeof schema.properties === 'object') {
    for (const key in schema.properties) {
      simplifyUnionTypesForGemini(schema.properties[key]);
    }
  }

  // Process array items
  if (schema.type === 'array' && schema.items) {
    if (typeof schema.items === 'object' && !Array.isArray(schema.items)) {
      simplifyUnionTypesForGemini(schema.items);
    }
  }

  // Process allOf members
  if ('allOf' in schema && Array.isArray(schema.allOf)) {
    for (const subSchema of schema.allOf) {
      if (isValidSchemaProperty(subSchema)) {
        simplifyUnionTypesForGemini(subSchema);
      }
    }
  }
}

/**
 * Simplify union types in JSON schema
 * Creates a deep clone and applies type simplification for model compatibility
 */
export function simplifySchemaUnionTypes(schema: JsonSchema): JsonSchema {
  // Clone to avoid mutation
  const cloned = JSON.parse(JSON.stringify(schema)) as JsonSchema;

  // Apply simplification in-place
  simplifyUnionTypesForGemini(cloned);

  return cloned;
}

/**
 * Simplify a tool's schema for Gemini compatibility
 * Converts the tool's Zod schema to JSON Schema, simplifies it, and converts back to Zod
 *
 * @param tool - The original tool
 * @returns A new tool with simplified schema
 */
export function simplifyToolForGemini(tool: StructuredToolInterface): StructuredToolInterface {
  try {
    // Type assertion to avoid deep type instantiation issues
    const schema = tool.schema as any;

    // Convert Zod schema to JSON Schema
    const jsonSchema = zodToJsonSchema(schema) as JsonSchema;

    // Simplify union types
    const simplifiedJsonSchema = simplifySchemaUnionTypes(jsonSchema);

    // Convert back to Zod schema
    const simplifiedZodSchema = JSONSchemaToZod.convert(simplifiedJsonSchema);

    // Create a new tool with the simplified schema
    const simplifiedTool = new DynamicStructuredTool({
      name: tool.name,
      description: tool.description,
      schema: simplifiedZodSchema as any,
      func: tool.invoke.bind(tool),
    });

    // Preserve metadata if it exists (optional field)
    if ('metadata' in tool && tool.metadata) {
      (simplifiedTool as any).metadata = tool.metadata;
    }

    return simplifiedTool;
  } catch (error) {
    // If simplification fails, return the original tool
    console.warn(`Failed to simplify tool "${tool.name}" for Gemini:`, error);
    return tool;
  }
}
