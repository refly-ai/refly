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
  SchemaProperty,
  User,
} from '@refly/openapi-schema';
import type { ExtendedUpsertDriveFileRequest } from '../drive/drive.service';
import { fileTypeFromBuffer } from 'file-type';
import _ from 'lodash';
import mime from 'mime';
import { DriveService } from '../drive/drive.service';
import { MiscService } from '../misc/misc.service';
import {
  collectResourceFields,
  extractFileId,
  isValidFileId,
  removeFieldsRecursively,
  type ResourceField,
} from './utils/schema-utils';
import { getCanvasId, getCurrentUser, getResultId, getResultVersion } from './tool-context';

/**
 * Error thrown when fileId format is invalid
 */
export class InvalidFileIdError extends Error {
  constructor(
    public readonly fieldName: string,
    public readonly invalidValue: unknown,
  ) {
    const valueStr = typeof invalidValue === 'string' ? invalidValue : JSON.stringify(invalidValue);
    super(
      `Invalid fileId format for field "${fieldName}": "${valueStr}". Expected formats: "df-xxx", "fileId://df-xxx", or "@file:df-xxx". Please provide a valid file ID.`,
    );
    this.name = 'InvalidFileIdError';
  }
}

/**
 * Error thrown when resource value is neither a valid fileId nor a public URL
 */
export class InvalidResourceInputError extends Error {
  constructor(
    public readonly fieldName: string,
    public readonly invalidValue: unknown,
  ) {
    const valueStr = typeof invalidValue === 'string' ? invalidValue : JSON.stringify(invalidValue);
    super(
      `Invalid resource value for "${fieldName}": "${valueStr}". Provide a valid Drive fileId (df-xxx / fileId://df-xxx / @file:df-xxx) or a public URL (http/https).`,
    );
    this.name = 'InvalidResourceInputError';
  }
}
/**
 * Processing mode for resource handling
 */
type ProcessingMode = 'input' | 'output';

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
   * Preprocess input resources by converting fileId to target format(url, base64, etc)
   *
   * @param request - Handler request containing params with fileIds
   * @param request_schema - JSON schema from db with isResource markers and formats
   * @returns Processed fileId of request replaced by target format
   */
  async resolveInputResources(
    request: HandlerRequest,
    request_schema: JsonSchema,
  ): Promise<HandlerRequest> {
    if (!request_schema?.properties) {
      this.logger.debug('No schema properties to process');
      return request;
    }

    const processedParams = await this.mapResourceFields(
      request_schema,
      request.params as Record<string, unknown>,
      async (value, schemaProperty) => {
        return await this.resolveFileIdToFormat(value, schemaProperty.format || 'text');
      },
      'input',
    );

    return {
      ...request,
      params: processedParams as Record<string, unknown>,
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
   * @param response_schema - Response schema from db with isResource markers and formats
   * @returns Processed response with content replaced by fileIds
   */
  async persistOutputResources(
    response: HandlerResponse,
    request: HandlerRequest,
    response_schema: JsonSchema,
  ): Promise<HandlerResponse> {
    if (!response.success || !response.data) {
      return response;
    }

    const fileNameTitle = (request?.params as Record<string, unknown>)?.file_name_title as
      | string
      | 'untitled';

    // Case 1: Direct binary response from HTTP adapter
    if (Buffer.isBuffer(response.data)) {
      const uploadResult = await this.writeResource(response.data, fileNameTitle, undefined);
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
    if (!response_schema?.properties) {
      return response;
    }

    // Use batch processing to handle multiple resources with a single lock acquisition
    const { processedData, processedFiles } = await this.batchProcessOutputResources(
      response.data as Record<string, unknown>,
      response_schema,
      fileNameTitle,
    );

    return {
      ...response,
      data: processedData,
      files: processedFiles.length > 0 ? processedFiles : undefined,
    };
  }

  /**
   * Batch process output resources to avoid lock contention
   * Collects all resource values first, then creates them in a single batch call
   * Handles both object and array root data types
   */
  private async batchProcessOutputResources(
    data: Record<string, unknown> | Record<string, unknown>[],
    schema: JsonSchema,
    fileNameTitle?: string,
  ): Promise<{
    processedData: Record<string, unknown> | Record<string, unknown>[];
    processedFiles: DriveFile[];
  }> {
    // Step 1: Remove omitFields from the data structure
    const omitFields = schema.omitFields || [];
    if (omitFields.length > 0) {
      if (Array.isArray(data)) {
        for (const item of data) {
          removeFieldsRecursively(item, omitFields);
        }
      } else {
        removeFieldsRecursively(data, omitFields);
      }
    }

    // Step 2: Collect resource fields from schema
    const resourceFields = collectResourceFields(schema);

    if (resourceFields.length === 0) {
      return { processedData: data, processedFiles: [] };
    }

    // Step 3: Expand all array paths and collect resource values with their paths
    // Handle both array root and object root data types
    const resourceTasks: Array<{
      path: string;
      value: unknown;
      schema: SchemaProperty;
    }> = [];

    if (Array.isArray(data)) {
      // Root data is an array - iterate each item and prefix paths with array index
      for (let arrayIndex = 0; arrayIndex < data.length; arrayIndex++) {
        const item = data[arrayIndex];
        for (const field of resourceFields) {
          if (field.isArrayItem) {
            // Expand nested array paths within each array item
            const expandedPaths = this.expandArrayPaths(field.dataPath, field.arrayPaths, item);
            for (const path of expandedPaths) {
              const value = _.get(item, path);
              if (value !== undefined && value !== null) {
                // Prefix with array index for correct path in root array
                resourceTasks.push({
                  path: `[${arrayIndex}].${path}`,
                  value,
                  schema: field.schema,
                });
              }
            }
          } else {
            const value = _.get(item, field.dataPath);
            if (value !== undefined && value !== null) {
              // Prefix with array index for correct path in root array
              resourceTasks.push({
                path: `[${arrayIndex}].${field.dataPath}`,
                value,
                schema: field.schema,
              });
            }
          }
        }
      }
    } else {
      // Root data is an object - use paths directly
      for (const field of resourceFields) {
        if (field.isArrayItem) {
          const expandedPaths = this.expandArrayPaths(field.dataPath, field.arrayPaths, data);
          for (const path of expandedPaths) {
            const value = _.get(data, path);
            if (value !== undefined && value !== null) {
              resourceTasks.push({ path, value, schema: field.schema });
            }
          }
        } else {
          const value = _.get(data, field.dataPath);
          if (value !== undefined && value !== null) {
            resourceTasks.push({ path: field.dataPath, value, schema: field.schema });
          }
        }
      }
    }

    if (resourceTasks.length === 0) {
      return { processedData: data, processedFiles: [] };
    }

    // Step 4: Categorize and process resources
    const { urlRequests, nonUrlResults } = await this.categorizeAndProcessResources(
      resourceTasks,
      fileNameTitle,
    );

    // Step 5: Batch create URL resources and collect all results
    const { processedFiles, taskResults } = await this.batchCreateAndCollectResults(
      urlRequests,
      nonUrlResults,
    );

    // Step 6: Set results back to their original paths in data
    for (let i = 0; i < resourceTasks.length; i++) {
      const task = resourceTasks[i];
      const result = taskResults.get(i);
      if (result) {
        _.set(data, task.path, result);
      }
    }

    return { processedData: data, processedFiles };
  }

  /**
   * Categorize resource tasks into URL and non-URL resources, processing non-URL resources immediately
   */
  private async categorizeAndProcessResources(
    resourceTasks: Array<{ path: string; value: unknown; schema: SchemaProperty }>,
    fileNameTitle?: string,
  ): Promise<{
    urlRequests: Array<{ taskIndex: number; request: ExtendedUpsertDriveFileRequest }>;
    nonUrlResults: Array<{ taskIndex: number; result: DriveFile | null }>;
  }> {
    const canvasId = getCanvasId();
    const resultId = getResultId();
    const resultVersion = getResultVersion();

    const urlRequests: Array<{
      taskIndex: number;
      request: ExtendedUpsertDriveFileRequest;
    }> = [];
    const nonUrlResults: Array<{
      taskIndex: number;
      result: DriveFile | null;
    }> = [];

    for (let i = 0; i < resourceTasks.length; i++) {
      const task = resourceTasks[i];
      const fileName = fileNameTitle
        ? i === 0
          ? fileNameTitle
          : `${fileNameTitle}-${i}`
        : undefined;

      // Check if value is a URL string
      if (typeof task.value === 'string' && this.isPublicUrl(task.value)) {
        const { filename } = this.inferFileInfoFromUrl(
          task.value,
          fileName || 'untitled',
          'text/plain',
        );
        urlRequests.push({
          taskIndex: i,
          request: {
            canvasId,
            name: filename,
            externalUrl: task.value,
            source: 'agent',
            resultId,
            resultVersion,
          },
        });
      } else {
        // Handle non-URL resources individually (data URLs, base64, buffers)
        const result = await this.writeResource(task.value, fileName, task.schema);
        nonUrlResults.push({ taskIndex: i, result });
      }
    }

    return { urlRequests, nonUrlResults };
  }

  /**
   * Batch create URL resources and collect all results into a single map
   */
  private async batchCreateAndCollectResults(
    urlRequests: Array<{ taskIndex: number; request: ExtendedUpsertDriveFileRequest }>,
    nonUrlResults: Array<{ taskIndex: number; result: DriveFile | null }>,
  ): Promise<{
    processedFiles: DriveFile[];
    taskResults: Map<number, DriveFile | null>;
  }> {
    const processedFiles: DriveFile[] = [];
    const taskResults: Map<number, DriveFile | null> = new Map();

    // Add non-URL results to the map
    for (const { taskIndex, result } of nonUrlResults) {
      taskResults.set(taskIndex, result);
      if (result) {
        processedFiles.push(result);
      }
    }

    // Batch create URL resources
    if (urlRequests.length > 0) {
      const user = getCurrentUser();
      const canvasId = getCanvasId();

      const batchFiles = await this.driveService.batchCreateDriveFiles(user, {
        canvasId,
        files: urlRequests.map((r) => r.request),
      });

      // Map batch results back to task indices
      for (let i = 0; i < urlRequests.length; i++) {
        const taskIndex = urlRequests[i].taskIndex;
        const driveFile = batchFiles[i] || null;
        taskResults.set(taskIndex, driveFile);
        if (driveFile) {
          processedFiles.push(driveFile);
        }
      }
    }

    return { processedFiles, taskResults };
  }

  /**
   * Map resources in data based on schema definitions
   *
   * Two-phase approach:
   * 1. Collect resource field paths from schema (using collectResourceFields)
   * 2. Apply processor to each field in data (using lodash get/set)
   */
  private async mapResourceFields(
    schema: JsonSchema,
    data: Record<string, unknown> | Record<string, unknown>[],
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: ProcessingMode,
  ): Promise<Record<string, unknown> | Record<string, unknown>[]> {
    // Step 1: Remove omitFields from the data structure
    const omitFields = schema.omitFields || [];
    if (omitFields.length > 0) {
      if (Array.isArray(data)) {
        for (const item of data) {
          removeFieldsRecursively(item, omitFields);
        }
      } else {
        removeFieldsRecursively(data, omitFields);
      }
    }

    // Step 2: Collect resource fields from schema (done once)
    const resourceFields = collectResourceFields(schema);

    if (resourceFields.length === 0) {
      return data;
    }

    // Step 3: Process each data item
    if (Array.isArray(data)) {
      return Promise.all(
        data.map((item) => this.processDataWithFields(item, resourceFields, processor, mode)),
      );
    }

    return this.processDataWithFields(data, resourceFields, processor, mode);
  }

  /**
   * Process a single data object using pre-collected resource fields
   * Note: This method mutates the input data directly for performance
   */
  private async processDataWithFields(
    data: Record<string, unknown>,
    resourceFields: ResourceField[],
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: ProcessingMode,
  ): Promise<Record<string, unknown>> {
    // Collect all processing tasks
    const tasks: Array<{ path: string; schema: SchemaProperty; isOptionalResource?: boolean }> = [];

    for (const field of resourceFields) {
      if (field.isArrayItem) {
        // Expand array paths to concrete indices
        const expandedPaths = this.expandArrayPaths(field.dataPath, field.arrayPaths, data);
        for (const path of expandedPaths) {
          tasks.push({ path, schema: field.schema, isOptionalResource: field.isOptionalResource });
        }
      } else {
        tasks.push({
          path: field.dataPath,
          schema: field.schema,
          isOptionalResource: field.isOptionalResource,
        });
      }
    }

    // Process all fields in parallel (mutates data directly)
    await Promise.all(
      tasks.map(async ({ path, schema, isOptionalResource }) => {
        const value = _.get(data, path);
        if (value !== undefined) {
          const processed = await this.processResourceValue(
            value,
            schema,
            path,
            processor,
            mode,
            isOptionalResource,
          );
          _.set(data, path, processed);
        }
      }),
    );

    return data;
  }

  /**
   * Expand array paths to concrete indices based on actual data
   *
   * Example:
   * - path: "items[*].nested[*].image", arrayPaths: ["items", "items[*].nested"]
   * - data: { items: [{ nested: [{}, {}] }] }
   * - returns: ["items[0].nested[0].image", "items[0].nested[1].image"]
   */
  private expandArrayPaths(
    basePath: string,
    arrayPaths: string[],
    data: Record<string, unknown>,
  ): string[] {
    if (arrayPaths.length === 0) {
      return [basePath];
    }

    // Each entry: { path: current basePath with some [*] replaced, arrayPathIndex: next arrayPath to process }
    let current: Array<{ path: string; resolvedArrayPaths: string[] }> = [
      { path: basePath, resolvedArrayPaths: [...arrayPaths] },
    ];

    for (let depth = 0; depth < arrayPaths.length; depth++) {
      const next: Array<{ path: string; resolvedArrayPaths: string[] }> = [];

      for (const { path, resolvedArrayPaths } of current) {
        const arrayPath = resolvedArrayPaths[depth];
        const arrayData = _.get(data, arrayPath);

        if (Array.isArray(arrayData)) {
          for (let i = 0; i < arrayData.length; i++) {
            // Replace first [*] with actual index
            const expandedPath = path.replace('[*]', `[${i}]`);
            // Also update remaining arrayPaths to use concrete index
            const updatedArrayPaths = resolvedArrayPaths.map((ap, idx) =>
              idx > depth ? ap.replace('[*]', `[${i}]`) : ap,
            );
            next.push({ path: expandedPath, resolvedArrayPaths: updatedArrayPaths });
          }
        }
      }

      if (next.length > 0) {
        current = next;
      }
    }

    return current.map((c) => c.path);
  }

  /**
   * Process a single resource field value
   *
   * @param isOptionalResource - If true, the field is from a oneOf/anyOf schema with non-resource alternatives.
   *                             In this case, if the value isn't a valid fileId, we skip processing instead of throwing.
   */
  private async processResourceValue(
    value: unknown,
    schema: SchemaProperty,
    fieldPath: string,
    processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
    mode: ProcessingMode,
    isOptionalResource?: boolean,
  ): Promise<unknown> {
    if (value === null || value === undefined) {
      return value;
    }

    if (mode === 'input') {
      // Allow direct URLs to pass through; if they contain a df-xxx, resolve it
      if (this.isPublicUrl(value)) {
        const maybeFileId = extractFileId(value);
        if (maybeFileId) {
          return processor(maybeFileId, schema);
        }
        return value;
      }
      if (!isValidFileId(value)) {
        // If this is an optional resource (part of oneOf/anyOf), skip processing for non-fileId values
        if (isOptionalResource) {
          return value;
        }
        throw new InvalidResourceInputError(fieldPath, value);
      }
    }

    return processor(value, schema);
  }

  /**
   * Upload Buffer resource to DriveService
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

    // Handle plain text - save as .txt file
    return await this.uploadTextResource(user, canvasId, value, fileName);
  }

  /**
   * Upload plain text resource
   */
  private async uploadTextResource(
    user: any,
    canvasId: string,
    text: string,
    fileName: string,
  ): Promise<DriveFile> {
    const filename = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
    const base64Content = Buffer.from(text, 'utf-8').toString('base64');

    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: filename,
      type: 'text/plain',
      content: base64Content,
      source: 'agent',
      resultId: getResultId(),
      resultVersion: getResultVersion(),
    });

    return driveFile;
  }

  /**
   * Upload data URL resource
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
    // Decode base64 to Buffer for binary file storage
    const buffer = Buffer.from(base64Data, 'base64');
    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: `${fileName}.${mime.getExtension(mimeType)}`,
      type: mimeType,
      buffer,
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
   */
  private async uploadBase64Resource(
    user: any,
    canvasId: string,
    base64String: string,
    fileName: string,
  ): Promise<DriveFile> {
    const buffer = Buffer.from(base64String, 'base64');

    // Detect MIME type from buffer, fallback to image/png
    const fileTypeResult = await fileTypeFromBuffer(buffer);
    const mimeType = fileTypeResult?.mime || 'image/png';
    const ext = fileTypeResult?.ext || 'png';

    const uploadResult = await this.miscService.uploadFile(user, {
      file: {
        buffer,
        mimetype: mimeType,
        originalname: `${fileName}.${ext}`,
      },
      visibility: 'private',
    });

    const driveFile = await this.driveService.createDriveFile(user, {
      canvasId,
      name: `${fileName}.${ext}`,
      storageKey: uploadResult.storageKey,
      source: 'agent',
      resultId: getResultId(),
      resultVersion: getResultVersion(),
    });

    return driveFile;
  }

  /**
   * Upload object resource with buffer property
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
   * Upload a resource value to DriveService (internal use with context)
   */
  private async writeResource(
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
   * Public method to upload a resource value to DriveService
   * Can be used by external services like ComposioService
   *
   * @param user - User context
   * @param canvasId - Canvas ID for storage
   * @param value - Resource value (Buffer, string URL, base64, data URL, or object with buffer)
   * @param fileName - File name for the uploaded resource
   * @param options - Optional configuration
   * @returns DriveFile if upload successful, null otherwise
   */
  async uploadResource(
    user: User,
    canvasId: string,
    value: unknown,
    fileName: string,
    options?: {
      /** Treat string as base64 encoded */
      isBase64?: boolean;
      resultId?: string;
      resultVersion?: number;
    },
  ): Promise<DriveFile | null> {
    try {
      // Handle Buffer type
      if (Buffer.isBuffer(value)) {
        return await this.uploadBufferResource(user, canvasId, value, fileName);
      }

      // Handle string type (URL, base64, data URL)
      if (typeof value === 'string') {
        // Create a schema property to trigger base64 handling
        const schemaProperty: SchemaProperty | undefined = options?.isBase64
          ? { type: 'string', format: 'base64' }
          : undefined;
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
   */
  private async resolveFileIdToFormat(value: unknown, format: string): Promise<string | Buffer> {
    // Extract fileId from value
    const fileId = extractFileId(value);
    if (!fileId) {
      const valuePreview =
        typeof value === 'string' ? value.slice(0, 50) : JSON.stringify(value)?.slice(0, 50);
      throw new Error(
        `Unable to extract fileId from resource value: ${valuePreview}. Expected formats: "df-xxx", "fileId://df-xxx", "@file:df-xxx", or { fileId: "df-xxx" }. Tip: Use @ in the input box to select and reference files.`,
      );
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

  private isPublicUrl(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      const parsed = new URL(value);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname;
    } catch {
      return false;
    }
  }

  /**
   * Upload tool execution result to DriveService as a JSON file
   * Used by tool post-handlers to archive full results when truncated
   *
   * @param user - User context
   * @param options - Upload options
   * @returns DriveFile if upload successful, null otherwise
   */
  async uploadToolResult(
    user: User,
    options: {
      canvasId: string;
      toolsetKey: string;
      toolName: string;
      content: string;
      resultId: string;
      resultVersion?: number;
    },
  ): Promise<DriveFile | null> {
    const { canvasId, toolsetKey, toolName, content, resultId, resultVersion } = options;

    if (!canvasId) {
      return null;
    }

    try {
      const rid = resultId ?? 'r';
      const version = resultVersion ?? 0;
      const fileName = `${toolsetKey}-${toolName}-${rid}-v${version}.txt`;

      const driveFile = await this.driveService.createDriveFile(user, {
        canvasId,
        name: fileName,
        type: 'text/plain',
        content, // Pass raw text directly - DriveService handles encoding
        summary: `${toolsetKey} ${toolName} result (${content.length} chars)`,
        source: 'agent',
        resultId,
        resultVersion,
      });

      return driveFile;
    } catch (error) {
      this.logger.error(`Failed to upload tool result: ${(error as Error)?.message}`, {
        toolsetKey,
        toolName,
      });
      return null;
    }
  }
}
