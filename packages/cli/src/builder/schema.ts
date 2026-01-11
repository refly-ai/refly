/**
 * Builder session schema and types
 */

import { z } from 'zod';

// Node schema
export const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  input: z.record(z.unknown()).default({}),
  dependsOn: z.array(z.string()).default([]),
});

export type WorkflowNode = z.infer<typeof NodeSchema>;

// Workflow draft schema
export const WorkflowDraftSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(NodeSchema).default([]),
  metadata: z
    .object({
      tags: z.array(z.string()).optional(),
      owner: z.string().optional(),
    })
    .optional(),
});

export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;

// Validation result
export const ValidationResultSchema = z.object({
  ok: z.boolean(),
  errors: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
        nodeId: z.string().optional(),
        details: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Builder state enum
export const BuilderState = {
  IDLE: 'IDLE',
  DRAFT: 'DRAFT',
  VALIDATED: 'VALIDATED',
  COMMITTED: 'COMMITTED',
  ABORTED: 'ABORTED',
} as const;

export type BuilderStateType = (typeof BuilderState)[keyof typeof BuilderState];

// Commit info
export const CommitInfoSchema = z.object({
  workflowId: z.string().optional(),
  committedAt: z.string().optional(),
});

export type CommitInfo = z.infer<typeof CommitInfoSchema>;

// Full session schema
export const BuilderSessionSchema = z.object({
  id: z.string(),
  version: z.number().default(1),
  state: z.enum(['IDLE', 'DRAFT', 'VALIDATED', 'COMMITTED', 'ABORTED']),
  createdAt: z.string(),
  updatedAt: z.string(),
  workflowDraft: WorkflowDraftSchema,
  validation: ValidationResultSchema.default({ ok: false, errors: [] }),
  commit: CommitInfoSchema.optional(),
});

export type BuilderSession = z.infer<typeof BuilderSessionSchema>;

// Diff types for operations
export interface NodeDiff {
  action: 'add' | 'update' | 'remove';
  nodeId: string;
  before?: WorkflowNode;
  after?: WorkflowNode;
}

export interface ConnectionDiff {
  action: 'connect' | 'disconnect';
  from: string;
  to: string;
}

export type Diff = NodeDiff | ConnectionDiff;
