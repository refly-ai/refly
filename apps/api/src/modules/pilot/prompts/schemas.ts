/**
 * Workflow agent schema definitions
 * Contains Zod schemas for todo.md structure and related data models
 */

import { z } from 'zod';

/**
 * Schema for the task in todo.md
 */
export const todoTaskSchema = z.object({
  id: z.string().describe('Unique identifier for the task'),
  description: z.string().describe('Description of the task'),
  priority: z.number().min(1).max(5).describe('Priority from 1 (highest) to 5 (lowest)'),
  dependencies: z.array(z.string()).optional().describe('IDs of tasks this depends on'),
  suggestedTool: z
    .enum(['commonQnA', 'webSearch', 'librarySearch', 'generateDoc', 'codeArtifacts'])
    .optional()
    .describe('Suggested tool for this task'),
});

/**
 * Schema for completed tasks in todo.md
 */
export const completedTaskSchema = todoTaskSchema.extend({
  completedInEpoch: z.number().describe('The epoch in which this task was completed'),
  findings: z.string().describe('Summary of findings from this task'),
  nodeIds: z.array(z.string()).describe('IDs of canvas nodes created for this task'),
});

/**
 * Schema for the full todo.md structure
 */
export const todoSchema = z.object({
  originalRequest: z.string().describe('The original user request'),
  status: z.enum(['in_progress', 'completed']).describe('Overall status of the workflow'),
  completedTasks: z.array(completedTaskSchema),
  pendingTasks: z.array(todoTaskSchema),
  currentEpoch: z.number().describe('The current epoch number'),
  maxEpoch: z.number().describe('The maximum number of epochs allowed'),
  summary: z.string().describe('Overall summary of findings so far'),
});

/**
 * Schema for workflow node outputs
 */
export const workflowNodeSchema = z.object({
  name: z.string().describe('A clear and concise title for the node'),
  skillName: z
    .enum(['commonQnA', 'webSearch', 'librarySearch', 'generateDoc', 'codeArtifacts'])
    .describe('The name of the skill to invoke'),
  query: z.string().describe('The query to ask the skill'),
  contextItemIds: z
    .array(z.string())
    .describe('The ID list of the relevant canvas items for this node'),
  parentIds: z.array(z.string()).describe('The IDs of parent nodes that this node builds upon'),
  goalCategory: z
    .enum(['research', 'synthesis', 'creation', 'analysis', 'verification'])
    .describe('The main purpose category of this node'),
  priority: z.number().min(1).max(5).describe('Priority level from 1 (highest) to 5 (lowest)'),
  todoTaskId: z.string().describe('ID of the related task in todo.md'),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .describe('Position on the canvas'),
});

/**
 * Schema for epoch summary
 */
export const epochSummarySchema = z.object({
  epoch: z.number().describe('Epoch number'),
  completedSteps: z.array(z.string()).describe('IDs of steps completed in this epoch'),
  findings: z.string().describe('Summary of findings from this epoch'),
  todoUpdates: z.object({
    tasksCompleted: z.array(z.string()).describe('IDs of tasks completed'),
    tasksAdded: z.array(z.string()).describe('IDs of new tasks added'),
    tasksModified: z.array(z.string()).describe('IDs of tasks modified'),
  }),
  nextSteps: z.string().describe('Recommended focus for the next epoch'),
});

// Type definitions derived from schemas
export type TodoTask = z.infer<typeof todoTaskSchema>;
export type CompletedTask = z.infer<typeof completedTaskSchema>;
export type TodoMd = z.infer<typeof todoSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type EpochSummary = z.infer<typeof epochSummarySchema>;
