/**
 * PostHandler Service
 * Post-processing for Composio tool execution results
 * Handles billing and large data resource upload
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ToolExecuteResponse } from '@composio/core';
import type { DriveFile, PostHandlerContext, PostHandlerResult } from '@refly/openapi-schema';
import { BillingService } from '../billing/billing.service';
import { ResourceHandler, getCanvasId } from '../utils';

/**
 * Size threshold for truncating/uploading data (characters)
 * Data larger than this will be truncated with "..." and saved as plain text
 * Default: 5000 characters
 */
const DEFAULT_UPLOAD_THRESHOLD = 5000;

@Injectable()
export class PostHandlerService {
  private readonly logger = new Logger(PostHandlerService.name);
  private readonly uploadThreshold = DEFAULT_UPLOAD_THRESHOLD;

  constructor(
    private readonly billingService: BillingService,
    private readonly resourceHandler: ResourceHandler,
  ) {}

  /**
   * Process tool execution result
   * 1. Record credit usage
   * 2. Check data size and upload large data to OSS
   * 3. Extract and return processed result
   */
  async process(
    response: ToolExecuteResponse,
    context: PostHandlerContext,
  ): Promise<PostHandlerResult> {
    const result: PostHandlerResult = {
      data: response.data,
    };

    try {
      // Step 1: Process billing
      if (response.successful && context.creditCost > 0) {
        await this.processBilling(context);
        result.creditCost = context.creditCost;
      }

      // Step 2: Process large data upload
      if (response.successful && response.data) {
        const uploadResult = await this.processDataUpload(response.data, context);
        if (uploadResult) {
          result.data = uploadResult.data;
          result.files = uploadResult.files;
        }
      }

      // Step 3: Add metadata
      result.metadata = {
        toolName: context.toolName,
        toolsetName: context.toolsetName,
        toolsetKey: context.toolsetKey,
        creditCost: result.creditCost,
        filesUploaded: result.files?.length ?? 0,
      };

      return result;
    } catch (error) {
      this.logger.error(
        `Post-processing failed for ${context.toolName}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return result;
    }
  }

  /**
   * Process billing - record credit usage using unified BillingService
   */
  private async processBilling(context: PostHandlerContext): Promise<void> {
    await this.billingService.processBilling({
      uid: context.user.uid,
      toolName: context.toolName,
      toolsetKey: context.toolsetKey,
      discountedPrice: context.creditCost,
      originalPrice: context.creditCost, // For Composio, original price equals discounted price
      resultId: context.resultId,
      version: context.version,
    });
  }

  /**
   * Process data upload for large responses
   */
  private async processDataUpload(
    data: unknown,
    context: PostHandlerContext,
  ): Promise<{ data: unknown; files: DriveFile[] } | null> {
    const files: DriveFile[] = [];
    const canvasId = getCanvasId();

    // Case 1: Direct buffer data
    if (Buffer.isBuffer(data)) {
      const file = await this.resourceHandler.uploadResource(
        context.user,
        canvasId,
        data,
        context.fileNameTitle ?? 'untitled',
      );
      if (file) {
        files.push(file);
        return {
          data: { fileId: file.fileId, mimeType: file.type, name: file.name },
          files,
        };
      }
    }

    // Case 2: Object with potential large string data
    if (data && typeof data === 'object') {
      const result = await this.processObjectData(data as Record<string, unknown>, context);
      if (result.files.length > 0) {
        return result;
      }
    }

    // Case 3: Large string data - truncate and save as plain text
    if (typeof data === 'string' && data.length > this.uploadThreshold) {
      const truncatedData = `${data.substring(0, this.uploadThreshold)}...`;
      const file = await this.resourceHandler.uploadResource(
        context.user,
        canvasId,
        truncatedData,
        `${context.fileNameTitle ?? 'untitled'}.txt`,
      );
      if (file) {
        files.push(file);
        return {
          data: { fileId: file.fileId, mimeType: file.type, name: file.name },
          files,
        };
      }
    }

    return null;
  }

  /**
   * Process object data recursively for large fields
   */
  private async processObjectData(
    data: Record<string, unknown>,
    context: PostHandlerContext,
  ): Promise<{ data: Record<string, unknown>; files: DriveFile[] }> {
    const files: DriveFile[] = [];
    const processedData = { ...data };
    const canvasId = getCanvasId();

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Process strategy:
        // 1. data: URI (base64) → Upload to OSS as public resource, return OSS URL
        // 2. http/https URL → Keep as-is, do NOT download
        // 3. Large text (non-URL) → Upload to OSS as text file
        const shouldProcess =
          value.startsWith('data:') || // Base64 embedded data (images, files, etc.)
          (value.length > this.uploadThreshold && !value.startsWith('http')); // Large text (but not URLs)

        if (shouldProcess) {
          const isBase64 =
            !value.startsWith('data:') && !value.startsWith('http') && this.isLikelyBase64(value);

          try {
            const file = await this.resourceHandler.uploadResource(
              context.user,
              canvasId,
              value,
              context.fileNameTitle ?? key ?? 'untitled',
              { isBase64 },
            );
            if (file) {
              files.push(file);
              // Return OSS URL as public resource
              processedData[key] = { fileId: file.fileId, mimeType: file.type, name: file.name };
            }
          } catch (error) {
            // If upload fails, keep original data
            this.logger.warn(
              `Failed to upload resource for key ${key}: ${error instanceof Error ? error.message : error}`,
            );
          }
        }
        // else: http/https URLs are kept as-is in processedData
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedResult = await this.processObjectData(
          value as Record<string, unknown>,
          context,
        );
        if (nestedResult.files.length > 0) {
          files.push(...nestedResult.files);
          processedData[key] = nestedResult.data;
        }
      } else if (Array.isArray(value)) {
        const processedArray = [];
        for (const item of value) {
          if (item && typeof item === 'object') {
            const itemResult = await this.processObjectData(
              item as Record<string, unknown>,
              context,
            );
            files.push(...itemResult.files);
            processedArray.push(itemResult.data);
          } else {
            processedArray.push(item);
          }
        }
        processedData[key] = processedArray;
      }
    }

    return { data: processedData, files };
  }

  /**
   * Check if a string is likely base64 encoded
   */
  private isLikelyBase64(str: string): boolean {
    if (str.length < 100 || str.length % 4 !== 0) {
      return false;
    }
    return /^[A-Za-z0-9+/=]+$/.test(str);
  }
}
