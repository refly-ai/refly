/**
 * Resource management utilities
 * Handles file upload, download, and resource field extraction for tool responses
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  HandlerRequest,
  HandlerResponse,
  JsonSchema,
  ResponseSchema,
  SchemaProperty,
  ToolResourceType,
  UploadResult,
} from '@refly/openapi-schema';
import mime from 'mime';
import { DriveService } from '../../drive/drive.service';
import { MiscService } from '../../misc/misc.service';
import { getCanvasId, getCurrentUser } from './core/tool-context';

/**
 * ResourceHandler Class
 * Encapsulates all resource preprocessing and postprocessing logic
 */

@Injectable()
export class ResourceHandler {
  private readonly logger = new Logger(ResourceHandler.name);

  constructor(
    private readonly driveService: DriveService,
    private readonly miscService: MiscService,
  ) {}

  /**
   * Preprocess input resources by traversing schema and data together
   * Automatically resolves all fields marked with isResource: true
   *
   * @param request - Handler request containing params with fileIds
   * @param schema - JSON schema with isResource markers
   * @returns Processed request with fileIds replaced by actual content
   */
  async preprocessInputResources(
    request: HandlerRequest,
    schema: JsonSchema,
  ): Promise<HandlerRequest> {
    if (!schema?.properties) {
      this.logger.debug('No schema properties to process');
      return request;
    }
    const processedParams = await this.processResourcesField(
      schema,
      request.params as Record<string, unknown>,
      async (value, schemaProperty) => {
        return await this.resolveFileIdToFormat(value, schemaProperty.format || 'text');
      },
    );

    return {
      ...request,
      params: processedParams,
    };
  }

  /**
   * Postprocess output resources by traversing schema and data together
   * Upload generated resources to DriveService and replace with fileIds
   *
   * Handles two cases:
   * 1. Direct binary response: response.data is { buffer, filename, mimetype }
   * 2. Structured response: response.data contains fields marked with isResource in schema
   *
   * @param response - Handler response containing resource content
   * @param request - Original handler request (for metadata)
   * @param schema - Response schema with isResource markers
   * @returns Processed response with content replaced by fileIds
   */
  async postprocessOutputResources(
    response: HandlerResponse,
    request: HandlerRequest,
    schema: ResponseSchema,
  ): Promise<HandlerResponse> {
    if (!response.success || !response.data) {
      return response;
    }
    // Case 1: Direct binary response from HTTP adapter
    // Response data is { buffer: Buffer, filename: string, mimetype: string }
    if (this.isDirectBinaryResponse(response.data)) {
      const uploadResult = await this.uploadResource(response.data, request);
      if (uploadResult) {
        return {
          ...response,
          data: { fileId: uploadResult.fileId },
          fileId: uploadResult.fileId,
        };
      }
      return response;
    }

    // Case 2: Structured response with schema-based resource fields
    if (!schema?.properties) {
      this.logger.debug('No schema properties to process');
      return response;
    }
    const processedData = await this.processResourcesField(
      schema as JsonSchema,
      response.data as Record<string, unknown>,
      async (value, schemaProperty) => {
        // Upload the resource and return fileId reference
        const result = await this.uploadResource(value, request, schemaProperty);
        return result ? { fileId: result.fileId } : value;
      },
      'output', // Output mode: accept any value, not just fileIds
    );

    return {
      ...response,
      data: processedData,
    };
  }

  /**
   * Check if response data is a direct binary response from HTTP adapter
   * Binary responses have the shape: { buffer: Buffer, filename: string, mimetype: string }
   */
  private isDirectBinaryResponse(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'buffer' in data &&
      'filename' in data &&
      'mimetype' in data &&
      Buffer.isBuffer((data as any).buffer)
    );
  }

  /**
   * Infer resource type from MIME type
   */
  private inferResourceType(mimeType: string): ToolResourceType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) {
      return 'document';
    }
    if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document')) {
      return 'document';
    }
    return 'document'; // Default fallback
  }

  /**
   * Upload Buffer resource to DriveService
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param buffer - Buffer data
   * @returns Upload result with fileId
   */
  private async uploadBufferResource(
    user: any,
    canvasId: string,
    buffer: Buffer,
  ): Promise<UploadResult> {
    const uploadResult = await this.miscService.uploadFile(user, {
      file: {
        buffer,
        mimetype: 'application/octet-stream',
        originalname: `resource-${Date.now()}.bin`,
      },
      visibility: 'private',
    });

    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: `resource-${Date.now()}.bin`,
      storageKey: uploadResult.storageKey,
      source: 'agent',
    });

    return {
      fileId: driveFile.fileId,
      resourceType: this.inferResourceType(driveFile.type),
      metadata: {
        size: Number(driveFile.size),
        mimeType: driveFile.type,
      },
    };
  }

  /**
   * Upload string resource (data URL, external URL, or base64)
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param value - String value
   * @param schemaProperty - Schema property with format information
   * @returns Upload result with fileId
   */
  private async uploadStringResource(
    user: any,
    canvasId: string,
    value: string,
    schemaProperty?: SchemaProperty,
  ): Promise<UploadResult | null> {
    // Handle data URL (data:image/png;base64,...)
    if (value.startsWith('data:')) {
      return await this.uploadDataUrlResource(user, canvasId, value);
    }

    // Handle external URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return await this.uploadExternalUrlResource(user, canvasId, value);
    }

    // Handle pure base64 string
    if (schemaProperty?.format === 'base64') {
      return await this.uploadBase64Resource(user, canvasId, value);
    }

    return null;
  }

  /**
   * Upload data URL resource
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param dataUrl - Data URL string
   * @returns Upload result with fileId
   */
  private async uploadDataUrlResource(
    user: any,
    canvasId: string,
    dataUrl: string,
  ): Promise<UploadResult | null> {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return null;
    }

    const [, mimeType, base64Data] = matches;
    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: `resource-${Date.now()}.${mime.getExtension(mimeType) || 'bin'}`,
      type: mimeType,
      content: base64Data,
      source: 'agent',
    });

    return {
      fileId: driveFile.fileId,
      resourceType: this.inferResourceType(driveFile.type),
      metadata: {
        size: Number(driveFile.size),
        mimeType: driveFile.type,
      },
    };
  }

  /**
   * Upload external URL resource
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param url - External URL
   * @returns Upload result with fileId
   */
  private async uploadExternalUrlResource(
    user: any,
    canvasId: string,
    url: string,
  ): Promise<UploadResult> {
    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: `resource-${Date.now()}.bin`,
      externalUrl: url,
      source: 'agent',
    });

    return {
      fileId: driveFile.fileId,
      resourceType: this.inferResourceType(driveFile.type),
      metadata: {
        size: Number(driveFile.size),
        mimeType: driveFile.type,
      },
    };
  }

  /**
   * Upload pure base64 resource
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param base64String - Base64 encoded string
   * @returns Upload result with fileId
   */
  private async uploadBase64Resource(
    user: any,
    canvasId: string,
    base64String: string,
  ): Promise<UploadResult> {
    const mimeType = 'image/png'; // Default for image generation tools
    const buffer = Buffer.from(base64String, 'base64');

    const uploadResult = await this.miscService.uploadFile(user, {
      file: {
        buffer,
        mimetype: mimeType,
        originalname: `resource-${Date.now()}.${mime.getExtension(mimeType) || 'png'}`,
      },
      visibility: 'private',
    });

    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: `resource-${Date.now()}.${mime.getExtension(mimeType) || 'png'}`,
      storageKey: uploadResult.storageKey,
      source: 'agent',
    });

    return {
      fileId: driveFile.fileId,
      resourceType: this.inferResourceType(driveFile.type),
      metadata: {
        size: Number(driveFile.size),
        mimeType: driveFile.type,
      },
    };
  }

  /**
   * Upload object resource with buffer property
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param obj - Object with buffer property
   * @returns Upload result with fileId
   */
  private async uploadObjectResource(
    user: any,
    canvasId: string,
    obj: any,
  ): Promise<UploadResult | null> {
    if (!obj.buffer || !Buffer.isBuffer(obj.buffer)) {
      return null;
    }

    const mimeType = obj.mimetype;
    const filename = obj.filename;

    try {
      const uploadResult = await this.miscService.uploadFile(user, {
        file: {
          buffer: obj.buffer,
          mimetype: mimeType,
          originalname: filename,
        },
        visibility: 'private',
      });

      this.logger.log(`[DEBUG] Uploaded to storage, storageKey: ${uploadResult.storageKey}`);

      const driveFile = await this.driveService.createDriveFile(user, {
        canvasId,
        name: filename,
        storageKey: uploadResult.storageKey,
        source: 'agent',
      });

      this.logger.log(
        `[DEBUG] Created DriveFile, fileId: ${driveFile.fileId}, size: ${driveFile.size}, type: ${driveFile.type}`,
      );

      return {
        fileId: driveFile.fileId,
        resourceType: this.inferResourceType(driveFile.type),
        metadata: {
          size: Number(driveFile.size),
          mimeType: driveFile.type,
        },
      };
    } catch (debugError) {
      this.logger.error(`[DEBUG] Error during upload process: ${(debugError as Error).message}`);
      throw debugError;
    }
  }

  /**
   * Upload a resource value to DriveService
   * @param value - Resource content (Buffer, base64, URL, etc.)
   * @param _request - Original handler request for metadata (unused but kept for signature compatibility)
   * @param schemaProperty - Schema property with format information (optional)
   * @returns Upload result with fileId
   */
  private async uploadResource(
    value: unknown,
    _request: HandlerRequest,
    schemaProperty?: SchemaProperty,
  ): Promise<UploadResult | null> {
    try {
      const user = getCurrentUser();
      const canvasId = getCanvasId();

      // Handle Buffer type
      if (Buffer.isBuffer(value)) {
        return await this.uploadBufferResource(user, canvasId, value);
      }

      // Handle string type (URL, base64, data URL)
      if (typeof value === 'string') {
        return await this.uploadStringResource(user, canvasId, value, schemaProperty);
      }

      // Handle object with buffer property
      if (value && typeof value === 'object') {
        return await this.uploadObjectResource(user, canvasId, value);
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to upload resource: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Resolve fileId to specified format
   * @param value - String fileId or object with fileId property
   * @param format - Output format (base64/url/binary/text, or legacy 'buffer')
   * @param fieldPath - Field path for logging
   * @returns Resolved content in specified format
   */
  private async resolveFileIdToFormat(value: unknown, format: string): Promise<string | Buffer> {
    // Extract fileId from value
    const fileId = typeof value === 'string' ? value : (value as any)?.fileId;
    if (!fileId) {
      throw new Error('Invalid resource value: missing fileId');
    }

    // Get user context
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User context is required for file resolution');
    }

    // Get drive file details
    const driveFile = await this.driveService.getDriveFileDetail(user, fileId);
    if (!driveFile) {
      throw new Error(`Drive file not found: ${fileId}`);
    }

    // Convert to specified format
    switch (format) {
      case 'url': {
        const urls = await this.driveService.generateDriveFileUrls(user, [driveFile]);
        if (!urls || urls.length === 0) {
          throw new Error(`Failed to generate URL for drive file: ${fileId}`);
        }
        return urls[0];
      }

      case 'base64': {
        const result = await this.driveService.getDriveFileStream(user, fileId);
        return result.data.toString('base64');
      }

      case 'text': {
        const result = await this.driveService.getDriveFileStream(user, fileId);
        return result.data.toString('utf-8');
      }

      case 'binary':
      case 'buffer': {
        // binary (OpenAPI standard) or buffer (legacy, kept for backward compatibility)
        const result = await this.driveService.getDriveFileStream(user, fileId);
        return result.data;
      }

      default: {
        // Default to binary format
        const result = await this.driveService.getDriveFileStream(user, fileId);
        return result.data;
      }
    }
  }

  /**
   * Process resources in data based on schema definitions
   * Traverses both schema and data simultaneously, processing fields marked with isResource
   *
   * @param schema - JSON schema with isResource markers
   * @param data - Data object to process
   * @param processor - Function to process each resource field
   * @param mode - 'input' for preprocessing (validate fileId), 'output' for postprocessing (accept any value)
   * @returns Processed data
   */
  private async processResourcesField(
    schema: JsonSchema,
    data: Record<string, unknown>,
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: 'input' | 'output' = 'input',
  ): Promise<Record<string, unknown>> {
    const result = { ...data };

    // Get omitFields from ResponseSchema and remove them recursively, to avoid sending too large data
    const responseSchema = schema as ResponseSchema;
    const omitFields = responseSchema.omitFields || [];
    if (omitFields.length > 0) {
      this.removeFieldsRecursively(result, omitFields);
    }

    // Process all root properties using the extracted traversal method
    if (schema.properties) {
      await Promise.all(
        Object.entries(schema.properties).map(async ([key, schemaProperty]) => {
          const value = data[key];
          if (value !== undefined) {
            await this.traverseSchema(schemaProperty, value, key, result, processor, mode);
          }
        }),
      );
    }

    return result;
  }

  /**
   * Validate if a value is a valid fileId
   * FileId must start with 'df-' prefix
   *
   * @param value - Value to validate (can be string or object with fileId property)
   * @returns True if the value is a valid fileId
   */
  private isValidFileId(value: unknown): boolean {
    if (typeof value === 'string') {
      return value.startsWith('df-');
    }
    if (value && typeof value === 'object' && 'fileId' in value) {
      const fileId = (value as any).fileId;
      return typeof fileId === 'string' && fileId.startsWith('df-');
    }
    return false;
  }

  /**
   * Remove specified fields from an object recursively
   * Traverses the entire object tree and removes all occurrences of the specified field names
   *
   * @param obj - Object to process
   * @param fieldsToOmit - Array of field names to remove
   */
  private removeFieldsRecursively(obj: any, fieldsToOmit: string[]): void {
    if (!obj || typeof obj !== 'object' || fieldsToOmit.length === 0) {
      return;
    }

    // Remove omitted fields from current object
    for (const field of fieldsToOmit) {
      if (field in obj) {
        delete obj[field];
      }
    }

    // Recursively process nested objects and arrays
    for (const key in obj) {
      const value = obj[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          this.removeFieldsRecursively(item, fieldsToOmit);
        }
      } else if (value && typeof value === 'object') {
        this.removeFieldsRecursively(value, fieldsToOmit);
      }
    }
  }

  /**
   * Handle oneOf/anyOf schema patterns
   * Processes fields that can be one of multiple types, finding resource options
   *
   * @param schemaProperty - Schema property with oneOf/anyOf
   * @param dataValue - Data value to process
   * @param key - Property key
   * @param parent - Parent object to update
   * @param processor - Function to process resource field
   * @param mode - Processing mode
   */
  private async handleOneOfAnyOfSchema(
    schemaProperty: SchemaProperty,
    dataValue: unknown,
    key: string,
    parent: Record<string, unknown>,
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: 'input' | 'output',
  ): Promise<void> {
    const schemaWithOneOf = schemaProperty as SchemaProperty & {
      oneOf?: SchemaProperty[];
      anyOf?: SchemaProperty[];
    };

    const options = schemaWithOneOf.oneOf || schemaWithOneOf.anyOf || [];
    const resourceOption = options.find((opt: SchemaProperty) => opt.isResource);

    if (resourceOption && dataValue !== undefined && dataValue !== null) {
      if (mode === 'output' || this.isValidFileId(dataValue)) {
        parent[key] = await processor(dataValue, resourceOption);
        return;
      }
    }

    parent[key] = dataValue;
  }

  /**
   * Handle resource fields
   * Processes fields marked with isResource flag
   *
   * @param schemaProperty - Schema property with isResource=true
   * @param dataValue - Data value to process
   * @param key - Property key
   * @param parent - Parent object to update
   * @param processor - Function to process resource field
   * @param mode - Processing mode
   */
  private async handleResource(
    schemaProperty: SchemaProperty,
    dataValue: unknown,
    key: string,
    parent: Record<string, unknown>,
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: 'input' | 'output',
  ): Promise<void> {
    if (dataValue === undefined || dataValue === null) {
      return;
    }

    // Input mode: validate fileId format - if invalid, skip processing
    if (mode === 'input' && !this.isValidFileId(dataValue)) {
      parent[key] = dataValue;
      return;
    }

    parent[key] = await processor(dataValue, schemaProperty);
  }

  /**
   * Handle array type fields
   * Processes arrays that may contain resource items or nested objects
   *
   * @param schemaProperty - Schema property with type='array'
   * @param dataValue - Array data value
   * @param key - Property key
   * @param parent - Parent object to update
   * @param processor - Function to process resource field
   * @param mode - Processing mode
   */
  private async handleArray(
    schemaProperty: SchemaProperty,
    dataValue: unknown,
    key: string,
    parent: Record<string, unknown>,
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: 'input' | 'output',
  ): Promise<void> {
    if (!Array.isArray(dataValue) || !schemaProperty.items) {
      return;
    }

    // Check if array items are resources
    if (schemaProperty.items.isResource) {
      const processed = await Promise.all(
        dataValue.map(async (item) => {
          if (item === undefined || item === null) {
            return item;
          }
          if (mode === 'input' && !this.isValidFileId(item)) {
            return item;
          }
          return await processor(item, schemaProperty.items!);
        }),
      );
      parent[key] = processed;
    } else if (schemaProperty.items.type === 'object' && schemaProperty.items.properties) {
      // Array of objects that might contain resources
      const processed = await Promise.all(
        dataValue.map(async (item) => {
          if (item && typeof item === 'object') {
            return await this.processResourcesField(
              { type: 'object', properties: schemaProperty.items!.properties! } as JsonSchema,
              item as Record<string, unknown>,
              processor,
              mode,
            );
          }
          return item;
        }),
      );
      parent[key] = processed;
    }
  }

  /**
   * Handle object type fields with nested properties
   * Recursively processes nested object structures
   *
   * @param schemaProperty - Schema property with type='object'
   * @param dataValue - Object data value
   * @param key - Property key
   * @param parent - Parent object to update
   * @param processor - Function to process resource field
   * @param mode - Processing mode
   */
  private async handleObject(
    schemaProperty: SchemaProperty,
    dataValue: unknown,
    key: string,
    parent: Record<string, unknown>,
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: 'input' | 'output',
  ): Promise<void> {
    if (!schemaProperty.properties || !dataValue || typeof dataValue !== 'object') {
      return;
    }

    const nestedData = dataValue as Record<string, unknown>;
    const processedNested = { ...nestedData };

    await Promise.all(
      Object.entries(schemaProperty.properties).map(async ([nestedKey, nestedSchema]) => {
        const nestedValue = nestedData[nestedKey];
        if (nestedValue !== undefined) {
          await this.traverseSchema(
            nestedSchema,
            nestedValue,
            nestedKey,
            processedNested,
            processor,
            mode,
          );
        }
      }),
    );

    parent[key] = processedNested;
  }

  /**
   * Recursively traverse schema and data together
   * Processes resource fields based on schema definitions
   *
   * @param schemaProperty - Schema property definition
   * @param dataValue - Data value to process
   * @param key - Property key
   * @param parent - Parent object to update
   * @param processor - Function to process each resource field
   * @param mode - Processing mode ('input' or 'output')
   */
  private async traverseSchema(
    schemaProperty: SchemaProperty,
    dataValue: unknown,
    key: string,
    parent: Record<string, unknown>,
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: 'input' | 'output',
  ): Promise<void> {
    const schemaWithOneOf = schemaProperty as SchemaProperty & {
      oneOf?: SchemaProperty[];
      anyOf?: SchemaProperty[];
    };

    // Case 0: Handle oneOf/anyOf schemas
    if (schemaWithOneOf.oneOf || schemaWithOneOf.anyOf) {
      await this.handleOneOfAnyOfSchema(schemaProperty, dataValue, key, parent, processor, mode);
      return;
    }

    // Case 1: This field is marked as a resource
    if (schemaProperty.isResource) {
      await this.handleResource(schemaProperty, dataValue, key, parent, processor, mode);
      return;
    }

    // Case 2: Array type
    if (schemaProperty.type === 'array') {
      await this.handleArray(schemaProperty, dataValue, key, parent, processor, mode);
      return;
    }

    // Case 3: Object with nested properties
    if (schemaProperty.type === 'object') {
      await this.handleObject(schemaProperty, dataValue, key, parent, processor, mode);
    }
  }
}
