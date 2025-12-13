/**
 * Schema Utilities
 *
 * Unified module for JSON Schema operations:
 * 1. Schema parsing, validation, and Zod conversion
 * 2. Schema traversal and resource field collection
 * 3. Default value filling
 * 4. FileId validation and extraction
 */

import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import type { JsonSchema, SchemaProperty } from '@refly/openapi-schema';
import traverse from 'json-schema-traverse';
import type { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

/**
 * Collected resource field information
 */
export interface ResourceField {
  /** JSON Pointer path (e.g., "/properties/image" or "/properties/items/items") */
  jsonPointer: string;
  /** Lodash-compatible path for data access (e.g., "image" or "items[*]") */
  dataPath: string;
  /** Schema definition for this field */
  schema: SchemaProperty;
  /** Whether this field is inside an array (requires expansion) */
  isArrayItem: boolean;
  /** Parent array paths that need expansion */
  arrayPaths: string[];
  /** Whether this resource is optional (part of oneOf/anyOf with non-resource alternatives) */
  isOptionalResource?: boolean;
}

// ============================================================================
// Schema Parsing & Validation
// ============================================================================

/**
 * Convert JSON schema to Zod schema
 * Uses @dmitryrechkin/json-schema-to-zod for runtime conversion
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
 */
export function parseJsonSchema(schemaJson: string): JsonSchema {
  try {
    const schema = JSON.parse(schemaJson);

    if (typeof schema !== 'object' || schema === null) {
      throw new Error('Schema must be an object');
    }

    return schema as JsonSchema;
  } catch (error) {
    throw new Error(`Invalid JSON schema: ${(error as Error).message}`);
  }
}

/**
 * Validate JSON schema structure
 */
export function validateJsonSchema(schema: JsonSchema): boolean {
  if (schema.type !== 'object') {
    throw new Error('Root schema must be of type "object"');
  }

  if (!schema.properties || typeof schema.properties !== 'object') {
    throw new Error('Schema must have properties field');
  }

  return true;
}

/**
 * Build Zod schema from JSON schema string
 * Combines parsing, validation, and conversion in one function
 */
export function buildSchema(schemaJson: string): z.ZodTypeAny {
  const jsonSchema = parseJsonSchema(schemaJson);
  validateJsonSchema(jsonSchema);
  return jsonSchemaToZod(jsonSchema);
}

// ============================================================================
// Default Value Filling
// ============================================================================

/**
 * Fill default values from JSON schema into input parameters
 * Recursively processes nested objects and arrays
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

  for (const [key, propertySchema] of Object.entries(properties)) {
    // If value is undefined or null, apply default if exists
    if (result[key] === undefined || result[key] === null) {
      if ('default' in propertySchema) {
        const defaultValue = propertySchema.default;
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
        result[key] = (result[key] as unknown[]).map((item) => {
          if (typeof item === 'object' && item !== null) {
            return fillDefaultValues(item as Record<string, unknown>, itemsSchema);
          }
          return item;
        });
      }
    }
  }

  return result;
}

// ============================================================================
// FileId Validation & Extraction
// ============================================================================

/**
 * Validate if a value is a valid fileId
 * FileId can be in formats:
 * - Direct: 'df-xxx'
 * - URI format: 'fileId://df-xxx'
 * - Mention format: '@file:df-xxx'
 * - Path format: 'files/df-xxx'
 * - URL format: 'https://files.refly.ai/df-xxx'
 *
 * @param value - Value to validate (can be string or object with fileId property)
 * @returns True if the value is a valid fileId
 */
export function isValidFileId(value: unknown): boolean {
  return extractFileId(value) !== null;
}

/**
 * Extract fileId from various formats
 * @param value - Value that may contain a fileId (string or object with fileId property)
 * @returns The extracted fileId (df-xxx format) or null if not found
 */
export function extractFileId(value: unknown): string | null {
  if (typeof value === 'string') {
    return extractFileIdFromString(value);
  }
  if (value && typeof value === 'object' && 'fileId' in value) {
    const fileId = (value as { fileId: unknown }).fileId;
    return typeof fileId === 'string' ? extractFileIdFromString(fileId) : null;
  }
  return null;
}

/**
 * Extract fileId from a string in various formats
 * @param value - String value that may contain a fileId
 * @returns The extracted fileId (df-xxx format) or null if not found
 */
function extractFileIdFromString(value: string): string | null {
  // Direct format: 'df-xxx'
  if (value.startsWith('df-')) {
    return value;
  }
  // URI format: 'fileId://df-xxx'
  if (value.startsWith('fileId://df-')) {
    return value.slice('fileId://'.length);
  }
  // Mention format: '@file:df-xxx'
  if (value.startsWith('@file:df-')) {
    return value.slice('@file:'.length);
  }
  // Path format: 'files/df-xxx'
  if (value.startsWith('files/df-')) {
    return value.slice('files/'.length);
  }
  // URL format or fallback: extract 'df-xxx' pattern from anywhere in the string
  // Use lookbehind to ensure 'df-' is not preceded by alphanumeric (avoid matching 'pdf-xxx', 'abcdf-xxx')
  // This handles URLs like 'https://files.refly.ai/.../df-xxx' and any other format
  const match = value.match(/(?<![a-z0-9])(df-[a-z0-9]+)\b/i);
  if (match) {
    return match[1];
  }
  return null;
}

// ============================================================================
// Field Removal
// ============================================================================

/**
 * Remove specified fields from an object recursively
 */
export function removeFieldsRecursively(obj: unknown, fieldsToOmit: string[]): void {
  if (!obj || typeof obj !== 'object' || fieldsToOmit.length === 0) {
    return;
  }
  const fieldsSet = new Set(fieldsToOmit);
  removeFieldsWithSet(obj, fieldsSet);
}

function removeFieldsWithSet(obj: unknown, fieldsSet: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;

  const record = obj as Record<string, unknown>;

  for (const field of fieldsSet) {
    if (field in record) {
      delete record[field];
    }
  }

  for (const key in record) {
    const value = record[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        removeFieldsWithSet(item, fieldsSet);
      }
    } else if (value && typeof value === 'object') {
      removeFieldsWithSet(value, fieldsSet);
    }
  }
}

// ============================================================================
// Schema Traversal & Resource Field Collection
// ============================================================================

/**
 * Convert JSON Pointer to lodash-compatible data path
 *
 * Examples:
 * - "/properties/name" -> "name"
 * - "/properties/items/items/properties/image" -> "items[*].image"
 * - "/properties/config/properties/url" -> "config.url"
 * - "/oneOf/0/properties/data" -> "data"
 */
function jsonPointerToDataPath(jsonPointer: string): { path: string; arrayPaths: string[] } {
  const parts = jsonPointer.split('/').filter(Boolean);
  const pathParts: string[] = [];
  const arrayPaths: string[] = [];

  let i = 0;
  while (i < parts.length) {
    const part = parts[i];

    if (part === 'properties' && i + 1 < parts.length) {
      pathParts.push(parts[i + 1]);
      i += 2;
    } else if (part === 'items') {
      if (pathParts.length > 0) {
        const currentPath = pathParts.join('.');
        arrayPaths.push(currentPath);
        pathParts[pathParts.length - 1] += '[*]';
      }
      i += 1;
    } else if (part === 'oneOf' || part === 'anyOf') {
      i += 2;
    } else if (part === 'allOf') {
      i += 2;
    } else if (/^\d+$/.test(part)) {
      i += 1;
    } else {
      i += 1;
    }
  }

  return {
    path: pathParts.join('.'),
    arrayPaths,
  };
}

/**
 * Collect all resource fields from schema using json-schema-traverse
 */
export function collectResourceFields(schema: JsonSchema): ResourceField[] {
  const fields: ResourceField[] = [];

  traverse(schema, (subSchema, jsonPtr) => {
    if ((subSchema as SchemaProperty).isResource) {
      const { path, arrayPaths } = jsonPointerToDataPath(jsonPtr);

      if (path) {
        // Detect if this resource is inside a oneOf/anyOf (optional resource)
        // JSON pointer like "/properties/text/oneOf/1" indicates it's part of oneOf
        const isOptionalResource = /\/(oneOf|anyOf)\/\d+/.test(jsonPtr);

        fields.push({
          jsonPointer: jsonPtr,
          dataPath: path,
          schema: subSchema as SchemaProperty,
          isArrayItem: arrayPaths.length > 0,
          arrayPaths,
          isOptionalResource,
        });
      }
    }
  });

  return fields;
}

/**
 * Find the matching object option from oneOf/anyOf based on discriminator field
 */
export function findMatchingObjectOption(
  options: SchemaProperty[],
  dataObj: Record<string, unknown>,
): SchemaProperty | undefined {
  const objectOptions = options.filter(
    (opt: SchemaProperty) => opt.type === 'object' && opt.properties,
  );

  if (objectOptions.length === 0) {
    return undefined;
  }

  if (objectOptions.length === 1) {
    return objectOptions[0];
  }

  for (const option of objectOptions) {
    const props = option.properties!;
    let allConstMatch = true;
    let hasConst = false;

    for (const [propKey, propSchema] of Object.entries(props)) {
      if ('const' in propSchema && propSchema.const !== undefined) {
        hasConst = true;
        if (dataObj[propKey] !== (propSchema as { const: unknown }).const) {
          allConstMatch = false;
          break;
        }
      }
    }

    if (hasConst && allConstMatch) {
      return option;
    }
  }

  return objectOptions[0];
}

// ============================================================================
// Schema Enhancement for Composio Tools
// ============================================================================

/**
 * Check if a field name suggests it's a URL-related field
 * @param fieldName - The name of the field
 * @returns true if the field appears to be URL-related
 */
function isUrlRelatedField(fieldName: string): boolean {
  const fieldLower = fieldName.toLowerCase();

  // Skip fields that are ID references (e.g., fileId, imageId, documentId, media_ids, media_ids[0])
  // These are ID references, not actual URLs
  if (
    fieldLower.endsWith('id') ||
    fieldLower.endsWith('_id') ||
    fieldLower.endsWith('ids') ||
    fieldLower.endsWith('_ids') ||
    /ids?\[\d*\]$/.test(fieldLower) // handles media_ids[0], file_id[1], etc.
  ) {
    return false;
  }

  // Skip fields that are metadata/classification fields, not actual resources
  // e.g., media_category, file_type, image_format, image_width, document_status
  const nonResourceSuffixes = [
    '_category',
    '_height',
    '_length',
    '_type',
    '_format',
    '_method',
    '_mode',
    '_status',
    '_version',
    '_width',
    '_name',
    '_title',
    '_label',
    '_kind',
    '_class',
    '_size',
    '_count',
    '_index',
    '_order',
    '_position',
  ];
  if (nonResourceSuffixes.some((suffix) => fieldLower.endsWith(suffix))) {
    return false;
  }

  // URL/URI patterns - always match these with includes()
  const urlUriPatterns = ['_url', 'url', '_uri', 'uri'];
  if (urlUriPatterns.some((pattern) => fieldLower.includes(pattern))) {
    return true;
  }

  // Resource-related words that need strict word boundary matching
  // Matches: image, images, video, videos, etc.
  // Does NOT match: media_category, image_type (already excluded above)
  const resourceWords = [
    'image',
    'video',
    'audio',
    'file',
    'media',
    'photo',
    'picture',
    'attachment',
    'document',
  ];

  // Build regex pattern for strict word matching (with optional 's' for plurals)
  // Word boundaries: start of string, underscore, or end of string
  // Pattern: (^|_)word(s)?(_|$) matches "image", "images", "my_image", "image_data", "images_data"
  for (const word of resourceWords) {
    const pattern = new RegExp(`(^|_)${word}s?(_|$)`);
    if (pattern.test(fieldLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Recursively enhance schema properties to mark URL fields as resources
 * This follows the same pattern that ResourceHandler.collectResourceFields() expects
 * @param schema - Schema or schema property to enhance
 */
function enhanceSchemaProperties(schema: JsonSchema | SchemaProperty): void {
  if (!schema.properties) {
    return;
  }

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    // Only enhance string-type fields
    if (fieldSchema.type === 'string') {
      if (isUrlRelatedField(fieldName)) {
        // Mark as resource field (collectResourceFields will find this)
        fieldSchema.isResource = true;
        // Set format to 'url' (resolveFileIdToFormat will use this)
        fieldSchema.format = 'url';
        // Enhance description to guide LLM
        const originalDesc = fieldSchema.description || '';
        if (!originalDesc.includes('fileId')) {
          const hint =
            '\n\n**IMPORTANT:** This field ONLY accepts either: (1) a fileId from the context (format: df-xxxx), OR (2) a public URL. For uploaded files in the context, use the exact fileId value like "df-abc123" - the system will automatically convert it to a public URL. Do NOT use any other format or make up values.';
          fieldSchema.description = originalDesc + hint;
        }
      }
    }

    // Recursively process nested objects
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      enhanceSchemaProperties(fieldSchema);
    }

    // Process array items
    if (fieldSchema.type === 'array' && fieldSchema.items) {
      if (fieldSchema.items.type === 'string' && isUrlRelatedField(fieldName)) {
        // For arrays of URLs (e.g., images: string[])
        fieldSchema.items.isResource = true;
        fieldSchema.items.format = 'url';
      } else if (fieldSchema.items.type === 'object') {
        // For arrays of objects containing URL fields
        enhanceSchemaProperties(fieldSchema.items);
      }
    }

    // Handle oneOf/anyOf/allOf
    for (const key of ['oneOf', 'anyOf', 'allOf']) {
      if (fieldSchema[key] && Array.isArray(fieldSchema[key])) {
        for (const option of fieldSchema[key] as SchemaProperty[]) {
          if (option.type === 'object') {
            enhanceSchemaProperties(option);
          }
        }
      }
    }
  }
}

/**
 * Enhance tool schema to mark URL fields as resources and add file_name_title field
 * Follows the same schema rules used by ResourceHandler.resolveInputResources()
 *
 * This function:
 * 1. Identifies URL-related fields (image_url, video_url, etc.)
 * 2. Marks them with isResource: true and format: 'url'
 * 3. Enhances descriptions to guide LLM to use fileId format
 * 4. Adds file_name_title field for naming generated files
 *
 * The enhanced schema is used for:
 * - LLM guidance (via enhanced descriptions in Zod schema)
 * - Backend processing (via isResource markers for ResourceHandler)
 *
 * @param schema - Original JSON schema from Composio
 * @returns Enhanced schema with isResource markers for URL fields and file_name_title field
 *
 * @example
 * ```typescript
 * const original = {
 *   type: 'object',
 *   properties: {
 *     image_url: { type: 'string', description: 'URL to the image' }
 *   }
 * };
 *
 * const enhanced = enhanceToolSchema(original);
 * // Result:
 * // {
 * //   type: 'object',
 * //   properties: {
 * //     image_url: {
 * //       type: 'string',
 * //       description: 'URL to the image\n\n**For uploaded files:** Provide a fileId...',
 * //       isResource: true,
 * //       format: 'url'
 * //     },
 * //     file_name_title: {
 * //       type: 'string',
 * //       description: 'The title for the generated file...'
 * //     }
 * //   },
 * //   required: ['file_name_title']
 * // }
 * ```
 */
export function enhanceToolSchema(schema: JsonSchema): JsonSchema {
  // Deep clone to avoid mutation
  const enhanced = JSON.parse(JSON.stringify(schema)) as JsonSchema;

  // Enhance URL fields with resource markers
  enhanceSchemaProperties(enhanced);

  // Add file_name_title field for naming generated files
  addFileNameTitleField(enhanced);

  return enhanced;
}

/**
 * Add file_name_title field to schema for naming generated files
 * This field guides the AI to generate descriptive filenames for tool outputs
 * @param schema - Schema to enhance with file_name_title field (mutates in place)
 */
function addFileNameTitleField(schema: JsonSchema): void {
  // Ensure properties object exists
  if (!schema.properties) {
    schema.properties = {};
  }

  // Add file_name_title field if it doesn't already exist
  if (!schema.properties.file_name_title) {
    schema.properties.file_name_title = {
      type: 'string',
      description:
        'The title for the generated file. Should be concise and descriptive. This will be used as the filename.',
    };

    // Add file_name_title to required fields so AI will always generate it
    if (!schema.required) {
      schema.required = [];
    }
    if (!schema.required.includes('file_name_title')) {
      schema.required.push('file_name_title');
    }
  }
}
