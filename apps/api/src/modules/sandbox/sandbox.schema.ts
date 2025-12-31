/**
 * Refly Sandbox Worker - Redis Pub/Sub Protocol Schemas
 *
 * Protocol aligned with worker/lib/types.ts from refly-sandbox
 * Using Zod for runtime validation and type safety
 */

import { z } from 'zod';
import type { ErrorDetail } from '@refly/openapi-schema';

/**
 * S3 configuration for sandbox storage
 */
export const S3ConfigSchema = z.object({
  endPoint: z.string(),
  port: z.number().int().positive(),
  useSSL: z.boolean(),
  accessKey: z.string(),
  secretKey: z.string(),
  bucket: z.string(),
  region: z.string(),
});

export type S3Config = z.infer<typeof S3ConfigSchema>;

/**
 * Resource limits for code execution
 */
export const ExecutorLimitsSchema = z.object({
  maxFileSize: z.number().int().positive().optional(),
  maxTotalWrite: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().optional(),
  maxProcesses: z.number().int().positive().optional(),
});

export type ExecutorLimits = z.infer<typeof ExecutorLimitsSchema>;

export const ExecuteConfigSchema = z
  .object({
    s3: S3ConfigSchema,
    s3DrivePath: z.string(),
    timeout: z.number().int().positive(),
    limits: ExecutorLimitsSchema.optional(),
    codeSizeThreshold: z.number().int().positive().optional(),
    templateName: z.string().optional(),
    autoPauseDelay: z.number().int().positive().optional(),
  })
  .passthrough();

export type ExecuteConfig = z.infer<typeof ExecuteConfigSchema>;

export const ExecuteMetadataSchema = z
  .object({
    uid: z.string(),
    canvasId: z.string(),
  })
  .passthrough();

export type ExecuteMetadata = z.infer<typeof ExecuteMetadataSchema>;

export const LanguageSchema = z.enum(['python', 'javascript', 'shell']);

export type Language = z.infer<typeof LanguageSchema>;

/**
 * Worker execution request - sent to sandbox:execute:request channel
 * Matches worker/lib/types.ts:WorkerExecuteRequest
 */
export const WorkerExecuteRequestSchema = z.object({
  requestId: z.string().uuid(),
  code: z.string(),
  language: LanguageSchema,
  provider: z.string().optional(),
  config: ExecuteConfigSchema,
  metadata: ExecuteMetadataSchema,
});

export type WorkerExecuteRequest = z.infer<typeof WorkerExecuteRequestSchema>;

export const WorkerFileSchema = z.object({
  name: z.string(),
  storageKey: z.string(),
  size: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
});

export type WorkerFile = z.infer<typeof WorkerFileSchema>;

/** Uses ErrorDetail from @refly/openapi-schema for type safety */
export const WorkerErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type WorkerError = ErrorDetail;

export const WorkerExecuteResponseDataSchema = z.object({
  output: z.string().optional(),
  error: z.string().optional(),
  exitCode: z.number().int().optional(),
  executionTime: z.number().nonnegative().optional(),
  files: z.array(WorkerFileSchema).optional(),
  warnings: z.array(z.string()).optional(),
});

export type WorkerExecuteResponseData = z.infer<typeof WorkerExecuteResponseDataSchema>;

/** Sent to sandbox:execute:response:{requestId} channel */
export const WorkerExecuteResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['success', 'failed']),
  data: WorkerExecuteResponseDataSchema.optional(),
  errors: z.array(WorkerErrorSchema).optional(),
});

/** Manually defined to ensure ErrorDetail compatibility */
export type WorkerExecuteResponse = {
  requestId: string;
  status: 'success' | 'failed';
  data?: WorkerExecuteResponseData;
  errors?: ErrorDetail[];
};

export const SandboxExecutionContextSchema = z.object({
  uid: z.string(),
  canvasId: z.string(),
  s3Config: S3ConfigSchema,
  s3DrivePath: z.string(),
  timeout: z.number().int().positive().optional(),
  limits: ExecutorLimitsSchema.optional(),
  parentResultId: z.string().optional(),
  targetId: z.string().optional(),
  targetType: z.string().optional(),
  model: z.string().optional(),
  providerItemId: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
});

export type SandboxExecutionContext = z.infer<typeof SandboxExecutionContextSchema>;

export const SandboxExecuteParamsSchema = z.object({
  code: z.string(),
  language: LanguageSchema,
  provider: z.string().optional(),
});

export type SandboxExecuteParams = z.infer<typeof SandboxExecuteParamsSchema>;
