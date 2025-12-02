/**
 * Resource management utilities
 * Handles file upload, download, and resource field extraction for tool responses
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  DriveFile,
  HandlerRequest,
  HandlerResponse,
  JsonSchema,
  ResponseSchema,
  SchemaProperty,
} from '@refly/openapi-schema';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime';
import { DriveService } from '../../drive/drive.service';
import { MiscService } from '../../misc/misc.service';
import { getCanvasId, getCurrentUser, getResultId, getResultVersion } from './core/tool-context';

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

    const fileNameTitle = (request?.params as Record<string, unknown>)?.file_name_title as
      | string
      | 'untitled';

    // Case 1: Direct binary response from HTTP adapter
    if (Buffer.isBuffer(response.data)) {
      const uploadResult = await this.uploadResource(response.data, fileNameTitle, undefined);
      if (uploadResult) {
        return {
          ...response,
          data: uploadResult,
          files: [uploadResult],
        };
      }
      return response;
    }

    // Case 2: Structured response with schema-based resource fields
    if (!schema?.properties) {
      this.logger.debug('No schema properties to process');
      return response;
    }

    // Counter for generating unique file names and collect processed files
    let resourceCount = 0;
    const processedFiles: DriveFile[] = [];

    const processedData = await this.processResourcesField(
      schema as JsonSchema,
      response.data as Record<string, unknown>,
      async (value, schemaProperty) => {
        // Upload the resource and return fileId reference
        resourceCount++;
        const fileName = fileNameTitle ? `${fileNameTitle}-${resourceCount}` : undefined;
        const result = await this.uploadResource(value, fileName, schemaProperty);
        if (result) {
          processedFiles.push(result);
          return result;
        }
        return value;
      },
      'output', // Output mode: accept any value, not just fileIds
    );

    return {
      ...response,
      data: processedData,
      files: processedFiles.length > 0 ? processedFiles : undefined,
    };
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
    fileNameTitle: string,
  ): Promise<DriveFile> {
    // Infer MIME type and extension from buffer
    const fileTypeResult = await fileTypeFromBuffer(buffer);
    const mimetype = fileTypeResult?.mime;
    const ext = fileTypeResult?.ext;
    const filename = `${fileNameTitle}.${ext}`;

    const uploadResult = await this.miscService.uploadFile(user, {
      file: {
        buffer,
        mimetype,
        originalname: filename,
      },
      visibility: 'private',
    });

    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: filename,
      storageKey: uploadResult.storageKey,
      source: 'agent',
      resultId: getResultId(),
      resultVersion: getResultVersion(),
    });

    return driveFile;
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
    fileName: string,
    schemaProperty?: SchemaProperty,
  ): Promise<DriveFile | null> {
    // Handle data URL (data:image/png;base64,...)
    if (value.startsWith('data:')) {
      return await this.uploadDataUrlResource(user, canvasId, value, fileName);
    }

    // Handle external URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return await this.uploadUrlResource(user, canvasId, value, fileName);
    }

    // Handle pure base64 string
    if (schemaProperty?.format === 'base64') {
      return await this.uploadBase64Resource(user, canvasId, value, fileName);
    }

    return null;
  }

  /**
   * Upload data URL resource
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param dataUrl - Data URL string
   * @returns DriveFile data
   */
  private async uploadDataUrlResource(
    user: any,
    canvasId: string,
    dataUrl: string,
    fileName: string,
  ): Promise<DriveFile | null> {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return null;
    }

    const [, mimeType, base64Data] = matches;
    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: `${fileName}.${mime.getExtension(mimeType)}`,
      type: mimeType,
      content: base64Data,
      source: 'agent',
      resultId: getResultId(),
      resultVersion: getResultVersion(),
    });

    return driveFile;
  }

  private inferFileInfoFromUrl(
    url: string,
    title: string,
    fallbackMediaType: string,
  ): { filename: string; contentType: string } {
    if (!url) {
      const extension = mime.getExtension(fallbackMediaType) || fallbackMediaType;
      const baseName = title
        ? title.replace(/\.[a-zA-Z0-9]+(?:\?.*)?$/, '')
        : `media_${Date.now()}`;
      return {
        filename: `${baseName}.${extension}`,
        contentType: fallbackMediaType,
      };
    }

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Extract filename from URL path
      const urlFilename = pathname.split('/').pop() || '';

      // Extract extension from filename
      const extensionMatch = urlFilename.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
      const extension = extensionMatch ? extensionMatch[1].toLowerCase() : '';

      // Map extension to content type
      const contentType = mime.getType(extension) || fallbackMediaType;

      // Generate filename: use title if provided, otherwise use URL filename or fallback
      let baseFilename: string;
      if (title) {
        // Strip possible file extension from title
        const cleanTitle = title.replace(/\.[a-zA-Z0-9]+(?:\?.*)?$/, '');
        // Use title and infer proper extension from content type
        const inferredExtension = extension || mime.getExtension(contentType) || fallbackMediaType;
        baseFilename = `${cleanTitle}.${inferredExtension}`;
      } else {
        // Fallback to URL-based filename generation
        baseFilename = urlFilename || `media_${Date.now()}`;
        if (!baseFilename.includes('.')) {
          const inferredExtension =
            extension || mime.getExtension(contentType) || fallbackMediaType;
          baseFilename = `${baseFilename}.${inferredExtension}`;
        }
      }

      return { filename: baseFilename, contentType };
    } catch (error) {
      this.logger.warn(`Failed to parse URL for file info: ${url}`, error);
      const extension = mime.getExtension(fallbackMediaType) || fallbackMediaType;
      const baseName = title
        ? title.replace(/\.[a-zA-Z0-9]+(?:\?.*)?$/, '')
        : `media_${Date.now()}`;
      return {
        filename: `${baseName}.${extension}`,
        contentType: fallbackMediaType,
      };
    }
  }

  /**
   * Upload external URL resource
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param url - External URL
   * @returns DriveFile data
   */
  private async uploadUrlResource(
    user: any,
    canvasId: string,
    url: string,
    fileName: string,
  ): Promise<DriveFile> {
    const { filename } = this.inferFileInfoFromUrl(url, fileName, 'application/octet-stream');

    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: filename,
      externalUrl: url,
      source: 'agent',
      resultId: getResultId(),
      resultVersion: getResultVersion(),
    });

    return driveFile;
  }

  /**
   * Upload pure base64 resource
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param base64String - Base64 encoded string
   * @returns DriveFile data
   */
  private async uploadBase64Resource(
    user: any,
    canvasId: string,
    base64String: string,
    fileName: string,
  ): Promise<DriveFile> {
    const mimeType = 'image/png'; // Default for image generation tools
    const buffer = Buffer.from(base64String, 'base64');

    const uploadResult = await this.miscService.uploadFile(user, {
      file: {
        buffer,
        mimetype: mimeType,
        originalname: `${fileName}.${mime.getExtension(mimeType) || 'png'}`,
      },
      visibility: 'private',
    });

    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: `resource-${Date.now()}.${mime.getExtension(mimeType) || 'png'}`,
      storageKey: uploadResult.storageKey,
      source: 'agent',
      resultId: getResultId(),
      resultVersion: getResultVersion(),
    });

    return driveFile;
  }

  /**
   * Upload object resource with buffer property
   * @param user - Current user
   * @param canvasId - Canvas ID
   * @param obj - Object with buffer property
   * @returns DriveFile data
   */
  private async uploadObjectResource(
    user: any,
    canvasId: string,
    obj: any,
    fileNameTitle?: string,
  ): Promise<DriveFile | null> {
    if (!obj.buffer || !Buffer.isBuffer(obj.buffer)) {
      return null;
    }
    const mimeType = obj.mimetype;
    const filename = fileNameTitle;

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
        resultId: getResultId(),
        resultVersion: getResultVersion(),
      });

      this.logger.log(
        `[DEBUG] Created DriveFile, fileId: ${driveFile.fileId}, size: ${driveFile.size}, type: ${driveFile.type}`,
      );

      return driveFile;
    } catch (debugError) {
      this.logger.error(`[DEBUG] Error during upload process: ${(debugError as Error).message}`);
      throw debugError;
    }
  }

  /**
   * Upload a resource value to DriveService
   * @param value - Resource content (Buffer, base64, URL, etc.)
   * @param schemaProperty - Schema property with format information (optional)
   * @returns Upload result with fileId
   */
  private async uploadResource(
    value: unknown,
    fileName: string,
    schemaProperty?: SchemaProperty,
  ): Promise<DriveFile | null> {
    try {
      const user = getCurrentUser();
      const canvasId = getCanvasId();

      // Handle Buffer type
      if (Buffer.isBuffer(value)) {
        return await this.uploadBufferResource(user, canvasId, value, fileName);
      }

      // Handle string type (URL, base64, data URL)
      if (typeof value === 'string') {
        return await this.uploadStringResource(user, canvasId, value, fileName, schemaProperty);
      }

      // Handle object with buffer property
      if (value && typeof value === 'object') {
        return await this.uploadObjectResource(user, canvasId, value, fileName);
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to upload resource: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Resolve fileId to specified format
   * @param value - String fileId or object with fileId property (supports 'df-xxx' or 'fileId://df-xxx' format)
   * @param format - Output format (base64/url/binary/text, or legacy 'buffer')
   * @returns Resolved content in specified format
   */
  private async resolveFileIdToFormat(value: unknown, format: string): Promise<string | Buffer> {
    // Extract fileId from value
    let fileId = typeof value === 'string' ? value : (value as any)?.fileId;
    if (!fileId) {
      throw new Error('Invalid resource value: missing fileId');
    }

    // Strip prefix if present ('fileId://' or '@file:')
    if (fileId.startsWith('fileId://')) {
      fileId = fileId.slice('fileId://'.length);
    } else if (fileId.startsWith('@file:')) {
      fileId = fileId.slice('@file:'.length);
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
  private isValidFileId(value: unknown): boolean {
    if (typeof value === 'string') {
      return this.extractFileId(value) !== null;
    }
    if (value && typeof value === 'object' && 'fileId' in value) {
      const fileId = (value as any).fileId;
      return typeof fileId === 'string' && this.extractFileId(fileId) !== null;
    }
    return false;
  }

  /**
   * Extract fileId from various formats
   * @param value - String value that may contain a fileId
   * @returns The extracted fileId (df-xxx format) or null if not found
   */
  private extractFileId(value: string): string | null {
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
    // URL format: 'https://files.refly.ai/df-xxx'
    const urlMatch = value.match(/^https?:\/\/files\.refly\.ai\/(df-[a-z0-9]+)$/i);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Fallback: extract 'df-xxx' pattern from anywhere in the string
    // Use lookbehind to ensure 'df-' is not preceded by alphanumeric (avoid matching 'pdf-xxx', 'abcdf-xxx')
    const fallbackMatch = value.match(/(?<![a-z0-9])(df-[a-z0-9]+)\b/i);
    if (fallbackMatch) {
      return fallbackMatch[1];
    }
    return null;
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
   * Find the best matching object option from oneOf/anyOf based on data
   * Uses multiple strategies:
   * 1. Match by discriminator field (e.g., 'type' with const value)
   * 2. Match by property key overlap (prefer options with more matching keys)
   * 3. Prefer options that contain isResource fields when data has potential fileIds
   *
   * @param options - Array of schema options from oneOf/anyOf
   * @param dataObj - Data object to match against
   * @returns The best matching schema option, or undefined if no match
   */
  private findMatchingObjectOption(
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

    const dataKeys = Object.keys(dataObj);

    // Strategy 1: Try to match by discriminator field (e.g., 'type' with const value)
    for (const option of objectOptions) {
      const props = option.properties!;
      let allConstMatch = true;
      let hasConst = false;

      for (const [propKey, propSchema] of Object.entries(props)) {
        const schemaWithConst = propSchema as SchemaProperty & { const?: unknown };
        if (schemaWithConst.const !== undefined) {
          hasConst = true;
          if (dataObj[propKey] !== schemaWithConst.const) {
            allConstMatch = false;
            break;
          }
        }
      }

      if (hasConst && allConstMatch) {
        return option;
      }
    }

    // Strategy 2: Match by property key overlap and isResource presence
    // Prefer options where data keys match schema keys and contain isResource fields
    let bestOption: SchemaProperty | undefined;
    let bestScore = -1;

    for (const option of objectOptions) {
      const schemaKeys = Object.keys(option.properties!);
      const matchingKeys = dataKeys.filter((k) => schemaKeys.includes(k));
      const hasResourceField = Object.values(option.properties!).some(
        (prop) => (prop as SchemaProperty).isResource,
      );

      // Score: matching keys count + bonus for having resource fields
      let score = matchingKeys.length;
      if (hasResourceField) {
        // Check if any matching key has a value that looks like a fileId
        const hasFileIdValue = matchingKeys.some((k) => this.isValidFileId(dataObj[k]));
        if (hasFileIdValue) {
          score += 10; // Strong preference for options with resource fields when data has fileIds
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }

    return bestOption || objectOptions[0];
  }

  /**
   * Handle oneOf/anyOf schema patterns
   * Processes fields that can be one of multiple types, finding resource options
   * Also handles nested objects/arrays within oneOf/anyOf options
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

    // Case 1: Found a resource option and value matches resource criteria
    if (resourceOption && dataValue !== undefined && dataValue !== null) {
      if (mode === 'output' || this.isValidFileId(dataValue)) {
        parent[key] = await processor(dataValue, resourceOption);
        return;
      }
    }

    // Case 2: Value is an object - try to find matching object schema in oneOf/anyOf and process recursively
    if (dataValue && typeof dataValue === 'object' && !Array.isArray(dataValue)) {
      const dataObj = dataValue as Record<string, unknown>;
      // Find the best matching object option based on discriminator field (e.g., 'type') or structure
      const objectOption = this.findMatchingObjectOption(options, dataObj);
      if (objectOption?.properties) {
        const processedNested = { ...dataObj };
        await Promise.all(
          Object.entries(objectOption.properties).map(async ([nestedKey, nestedSchema]) => {
            const nestedValue = dataObj[nestedKey];
            if (nestedValue !== undefined) {
              await this.traverseSchema(
                nestedSchema as SchemaProperty,
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
        return;
      }
    }

    // Case 3: Value is an array - try to find matching array schema in oneOf/anyOf and process recursively
    if (Array.isArray(dataValue)) {
      const arrayOption = options.find((opt: SchemaProperty) => opt.type === 'array' && opt.items);
      if (arrayOption?.items) {
        // Delegate to handleArray for consistent array processing
        await this.handleArray(arrayOption, dataValue, key, parent, processor, mode);
        return;
      }
    }

    // Default: keep original value
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
