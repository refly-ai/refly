import { z } from 'zod/v3';
import {
  GenericToolset,
  RawCanvasData,
  CanvasNode,
  WorkflowVariable,
  WorkflowTask,
  WorkflowPlan,
  ModelInfo,
  VariableValue,
  WorkflowPatchOperation as OpenApiWorkflowPatchOperation,
} from '@refly/openapi-schema';
import { genNodeEntityId, genUniqueId } from '@refly/utils';
import { CanvasNodeFilter } from './types';
import { prepareAddNode } from './utils';

const replaceTaskAgentMentions = (prompt: string, taskEntityIdMap: Map<string, string>): string => {
  if (!prompt || taskEntityIdMap.size === 0) return prompt;
  return prompt.replace(/@\{type=agent,id=([^,}]+),name=([^}]+)\}/g, (match, taskId, name) => {
    const mappedId = taskEntityIdMap.get(taskId);
    if (!mappedId) return match;
    return `@{type=agent,id=${mappedId},name=${name}}`;
  });
};

// Task schema for workflow plan
export const workflowTaskSchema = z.object({
  id: z.string().describe('Unique ID for the task'),
  title: z.string().describe('Display title for the task'),
  prompt: z.string().describe('The prompt or instruction for this task'),
  dependentTasks: z
    .array(z.string().describe('Task ID'))
    .optional()
    .describe('Tasks that must be executed before this task'),
  toolsets: z.array(z.string().describe('Toolset ID')).describe('Toolsets selected for this task'),
});

// Variable value schema
export const workflowVariableValueSchema = z.object({
  type: z
    .enum(['text', 'resource'])
    .describe('Value type: text for string variables, resource for file uploads')
    .default('text'),
  text: z.string().optional().describe('Text value (for text type)'),
  resource: z
    .object({
      name: z.string().describe('Resource file name'),
      fileType: z.enum(['document', 'image', 'audio', 'video']).describe('Resource file type'),
    })
    .optional()
    .describe('Resource value (for resource type)'),
});

// Variable schema for workflow plan
export const workflowVariableSchema = z.object({
  variableId: z.string().describe('Variable ID, unique and readonly'),
  variableType: z
    .enum(['string', 'resource', 'option'])
    .describe(
      'Variable type: string for text input, resource for file upload, option for selection from predefined choices',
    )
    .default('string'),
  name: z.string().describe('Variable name used in the workflow'),
  description: z.string().describe('Description of what this variable represents'),
  required: z
    .boolean()
    .describe('Whether this variable is required. Defaults to false.')
    .default(false),
  resourceTypes: z
    .array(z.enum(['document', 'image', 'audio', 'video']))
    .optional()
    .describe('Accepted resource types (only for resource type variables)'),
  options: z
    .array(z.string())
    .optional()
    .describe('Predefined options for selection (only for option type variables)'),
  isSingle: z
    .boolean()
    .optional()
    .describe(
      'Whether only single selection is allowed (only for option type variables). Defaults to true.',
    ),
  value: z.array(workflowVariableValueSchema).describe('Variable values'),
});

export const workflowPlanSchema = z.object({
  title: z.string().describe('Title of the workflow plan'),
  tasks: z.array(workflowTaskSchema).describe('Array of workflow tasks to be executed'),
  variables: z
    .array(workflowVariableSchema)
    .describe('Array of variables defined for the workflow'),
});

// ============================================================================
// Semantic Patch Schema - Operations for granular workflow modifications
// ============================================================================

// Operation types enum
export const workflowPatchOpSchema = z.enum([
  'updateTitle',
  'createTask',
  'updateTask',
  'deleteTask',
  'createVariable',
  'updateVariable',
  'deleteVariable',
]);

export type WorkflowPatchOp = z.infer<typeof workflowPatchOpSchema>;

// Unified update data schema for both tasks and variables
export const workflowPatchDataSchema = z.object({
  // Task update fields
  title: z.string().optional().describe('New display title for the task'),
  prompt: z.string().optional().describe('New prompt or instruction for this task'),
  dependentTasks: z
    .array(z.string())
    .optional()
    .describe('New list of task IDs that must execute before this task'),
  toolsets: z.array(z.string()).optional().describe('New list of toolset IDs for this task'),

  // Variable update fields
  variableType: z.enum(['string', 'resource', 'option']).optional().describe('New variable type'),
  name: z.string().optional().describe('New variable name'),
  description: z.string().optional().describe('New variable description'),
  required: z.boolean().optional().describe('Whether this variable is required'),
  resourceTypes: z
    .array(z.enum(['document', 'image', 'audio', 'video']))
    .optional()
    .describe('New accepted resource types'),
  options: z.array(z.string()).optional().describe('New predefined options for selection'),
  isSingle: z.boolean().optional().describe('Whether only single selection is allowed'),
  value: z.array(workflowVariableValueSchema).optional().describe('New variable values'),
});

// Union of all patch operations - replaced with a single object for LLM compatibility
export const workflowPatchOperationSchema = z.object({
  op: workflowPatchOpSchema.describe('Operation type'),
  title: z.string().optional().describe('New workflow title (for updateTitle)'),
  taskId: z.string().optional().describe('ID of the task (for updateTask, deleteTask)'),
  task: workflowTaskSchema.optional().describe('Task definition (for createTask)'),
  variableId: z
    .string()
    .optional()
    .describe('ID of the variable (for updateVariable, deleteVariable)'),
  variable: workflowVariableSchema.optional().describe('Variable definition (for createVariable)'),
  data: workflowPatchDataSchema.optional().describe('Update data (for updateTask, updateVariable)'),
});

// Main patch schema with operations array
export const workflowPlanPatchSchema = z.object({
  planId: z
    .string()
    .optional()
    .describe(
      'The ID of the workflow plan to patch. If not provided, the latest version of the plan within this session will be chosen.',
    ),
  operations: z
    .array(workflowPatchOperationSchema)
    .describe('Array of operations to apply to the workflow plan (in order)'),
});

export type WorkflowTaskInput = z.infer<typeof workflowTaskSchema>;
export type WorkflowVariableValue = z.infer<typeof workflowVariableValueSchema>;
export type WorkflowVariableInput = z.infer<typeof workflowVariableSchema>;
// Re-export the OpenAPI type for consistency across the codebase
export type WorkflowPatchOperation = OpenApiWorkflowPatchOperation;
export type WorkflowPlanPatch = z.infer<typeof workflowPlanPatchSchema>;

// Result of applying patch operations
export type ApplyPatchResult = {
  success: boolean;
  data?: WorkflowPlan;
  error?: string;
};

/**
 * Apply semantic patch operations to a workflow plan
 * Operations are applied in order
 */
export const applyWorkflowPatchOperations = (
  currentPlan: WorkflowPlan,
  operations: WorkflowPatchOperation[],
): ApplyPatchResult => {
  // Create a mutable copy of the current plan
  const plan: WorkflowPlan = {
    title: currentPlan.title,
    tasks: [...(currentPlan.tasks ?? [])],
    variables: [...(currentPlan.variables ?? [])],
  };

  for (const operation of operations) {
    const { op, title, taskId, task, variableId, variable, data } = operation;

    switch (op) {
      case 'updateTitle': {
        if (title !== undefined) {
          plan.title = title;
        }
        break;
      }

      case 'createTask': {
        if (!task) break;
        // Validate task has required fields
        const validatedTask = workflowTaskSchema.safeParse(task);
        if (!validatedTask.success) {
          return {
            success: false,
            error: `Invalid task data: ${validatedTask.error.message}`,
          };
        }
        // Check if task ID already exists
        const existingTask = plan.tasks?.find((t) => t.id === validatedTask.data.id);
        if (existingTask) {
          return {
            success: false,
            error: `Task with ID "${validatedTask.data.id}" already exists. Use updateTask to modify existing tasks.`,
          };
        }
        plan.tasks!.push(validatedTask.data as WorkflowTask);
        break;
      }

      case 'updateTask': {
        if (!taskId) break;
        const taskIndex = plan.tasks?.findIndex((t) => t.id === taskId) ?? -1;
        if (taskIndex === -1) {
          return {
            success: false,
            error: `Task with ID "${taskId}" not found. Use createTask to create new tasks.`,
          };
        }
        const existingTask = plan.tasks![taskIndex];
        if (data) {
          plan.tasks![taskIndex] = {
            ...existingTask,
            ...(data.title !== undefined && { title: data.title }),
            ...(data.prompt !== undefined && { prompt: data.prompt }),
            ...(data.dependentTasks !== undefined && {
              dependentTasks: data.dependentTasks,
            }),
            ...(data.toolsets !== undefined && { toolsets: data.toolsets }),
          };
        }
        break;
      }

      case 'deleteTask': {
        if (!taskId) break;
        const taskIndex = plan.tasks?.findIndex((t) => t.id === taskId) ?? -1;
        if (taskIndex === -1) {
          return {
            success: false,
            error: `Task with ID "${taskId}" not found.`,
          };
        }
        plan.tasks = plan.tasks?.filter((t) => t.id !== taskId) ?? [];
        // Also remove references to this task from dependentTasks
        plan.tasks = plan.tasks.map((t) => ({
          ...t,
          dependentTasks: t.dependentTasks?.filter((depId) => depId !== taskId),
        }));
        break;
      }

      case 'createVariable': {
        if (!variable) break;
        // Validate variable has required fields
        const validatedVariable = workflowVariableSchema.safeParse(variable);
        if (!validatedVariable.success) {
          return {
            success: false,
            error: `Invalid variable data: ${validatedVariable.error.message}`,
          };
        }
        // Check if variable ID already exists
        const existingVar = plan.variables?.find(
          (v) => v.variableId === validatedVariable.data.variableId,
        );
        if (existingVar) {
          return {
            success: false,
            error: `Variable with ID "${validatedVariable.data.variableId}" already exists. Use updateVariable to modify existing variables.`,
          };
        }
        plan.variables!.push(validatedVariable.data as WorkflowVariable);
        break;
      }

      case 'updateVariable': {
        if (!variableId) break;
        const varIndex = plan.variables?.findIndex((v) => v.variableId === variableId) ?? -1;
        if (varIndex === -1) {
          return {
            success: false,
            error: `Variable with ID "${variableId}" not found. Use createVariable to create new variables.`,
          };
        }
        const existingVar = plan.variables![varIndex];
        if (data) {
          const updatedVar = {
            ...existingVar,
            ...(data.variableType !== undefined && {
              variableType: data.variableType,
            }),
            ...(data.name !== undefined && { name: data.name }),
            ...(data.description !== undefined && {
              description: data.description,
            }),
            ...(data.required !== undefined && { required: data.required }),
            ...(data.resourceTypes !== undefined && {
              resourceTypes: data.resourceTypes,
            }),
            ...(data.options !== undefined && { options: data.options }),
            ...(data.isSingle !== undefined && { isSingle: data.isSingle }),
            ...(data.value !== undefined && { value: data.value }),
          };
          // Validate the updated variable
          const validatedVariable = workflowVariableSchema.safeParse(updatedVar);
          if (!validatedVariable.success) {
            return {
              success: false,
              error: `Invalid variable update: ${validatedVariable.error.message}`,
            };
          }
          plan.variables![varIndex] = validatedVariable.data as WorkflowVariable;
        }
        break;
      }

      case 'deleteVariable': {
        if (!variableId) break;
        const varIndex = plan.variables?.findIndex((v) => v.variableId === variableId) ?? -1;
        if (varIndex === -1) {
          return {
            success: false,
            error: `Variable with ID "${variableId}" not found.`,
          };
        }
        plan.variables = plan.variables?.filter((v) => v.variableId !== variableId) ?? [];
        break;
      }

      default: {
        // Type safety check - should never reach here
        const _exhaustiveCheck: never = op;
        return {
          success: false,
          error: `Unknown operation type: ${_exhaustiveCheck as string}`,
        };
      }
    }
  }

  return { success: true, data: plan };
};

/**
 * Parse and validate workflow plan patch input
 */
export const parseWorkflowPlanPatch = (
  data: unknown,
): { success: boolean; data?: WorkflowPlanPatch; error?: string } => {
  const result = workflowPlanPatchSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessages: string[] = [];
  for (const issue of result.error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    errorMessages.push(`[${path}]: ${issue.message}`);
  }

  return {
    success: false,
    error: `Workflow plan patch validation failed:\n${errorMessages.join('\n')}`,
  };
};

// Enhanced parsing function with detailed error reporting
export type ParseWorkflowPlanResult = {
  success: boolean;
  data?: WorkflowPlan;
  error?: string;
};

export const parseWorkflowPlan = (data: unknown): ParseWorkflowPlanResult => {
  const result = workflowPlanSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data as WorkflowPlan };
  }

  // Collect detailed error messages
  const errorMessages: string[] = [];

  for (const issue of result.error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    errorMessages.push(`[${path}]: ${issue.message}`);
  }

  return {
    success: false,
    error: `Workflow plan validation failed:\n${errorMessages.join('\n')}`,
  };
};

export const normalizeWorkflowPlan = (plan: WorkflowPlan): WorkflowPlan => {
  return {
    ...plan,
    tasks:
      plan.tasks?.map((task) => {
        // Ensure toolsets array exists
        const toolsets = Array.isArray(task.toolsets) ? [...task.toolsets] : [];

        return {
          ...task,
          toolsets,
        };
      }) ?? [],
  };
};

/**
 * Input type for variable conversion - accepts loose typing from patch operations
 */
interface PlanVariableInput {
  variableId?: string;
  name?: string;
  value?: Array<{
    type?: 'text' | 'resource' | string;
    text?: string;
    resource?: {
      name?: string;
      fileType?: 'document' | 'image' | 'video' | 'audio' | string;
    };
  }>;
  description?: string;
  variableType?: 'string' | 'option' | 'resource' | string;
  required?: boolean;
  resourceTypes?: Array<'document' | 'image' | 'video' | 'audio'>;
}

export const planVariableToWorkflowVariable = (
  planVariable: PlanVariableInput,
): WorkflowVariable | null => {
  // Ensure required fields are present
  if (!planVariable.variableId || !planVariable.name) {
    return null;
  }

  return {
    variableId: planVariable.variableId,
    variableType: (planVariable.variableType as 'string' | 'option' | 'resource') ?? 'string',
    name: planVariable.name,
    value:
      planVariable.value?.map((value) => ({
        type: (value?.type as 'text' | 'resource') ?? 'text',
        text: value?.text,
        // Only include resource if it has the required fields
        ...(value?.resource?.name && value?.resource?.fileType
          ? {
              resource: {
                name: value.resource.name,
                fileType: value.resource.fileType as 'document' | 'image' | 'video' | 'audio',
              },
            }
          : {}),
      })) ?? [],
    description: planVariable.description ?? '',
    required: planVariable.required ?? false,
    resourceTypes: planVariable.resourceTypes,
    options: planVariable.options,
    isSingle: planVariable.isSingle,
  };
};

// Generate canvas data from workflow plan
// 1. each task should be represented as a 'skillResponse' node
// 2. connect task nodes via dependentTasks
export const generateCanvasDataFromWorkflowPlan = (
  workflowPlan: WorkflowPlan,
  toolsets: GenericToolset[],
  options?: { autoLayout?: boolean; defaultModel?: ModelInfo; startNodes?: CanvasNode[] },
): RawCanvasData => {
  const nodes: RawCanvasData['nodes'] = [];
  const edges: RawCanvasData['edges'] = [];

  // Maps to resolve context references
  const taskIdToNodeId = new Map<string, string>();
  const taskIdToEntityId = new Map<string, string>();

  const { autoLayout = false, defaultModel, startNodes = [] } = options ?? {};

  // Simple layout positions for non-auto-layout mode
  const taskStartX = 0;
  const rowStepY = 240;

  if (Array.isArray(workflowPlan.tasks) && workflowPlan.tasks.length > 0) {
    // Phase 0: Pre-generate entity IDs for all tasks to enable complete ID replacement
    // This ensures that when we replace agent mentions in prompts, we have all task-to-entity mappings available
    for (const task of workflowPlan.tasks) {
      const taskId = task?.id ?? `task-${genUniqueId()}`;
      const taskEntityId = genNodeEntityId('skillResponse');
      taskIdToEntityId.set(taskId, taskEntityId);
    }

    // Phase 1: Process tasks in dependency order
    // First, identify tasks with no dependencies (roots)
    const taskMap = new Map<string, (typeof workflowPlan.tasks)[0]>();
    const dependencyGraph = new Map<string, Set<string>>();

    for (const task of workflowPlan.tasks) {
      const taskId = task?.id ?? `task-${genUniqueId()}`;
      taskMap.set(taskId, task);

      if (Array.isArray(task.dependentTasks)) {
        for (const depTaskId of task.dependentTasks) {
          if (!dependencyGraph.has(taskId)) {
            dependencyGraph.set(taskId, new Set());
          }
          dependencyGraph.get(taskId)!.add(depTaskId);
        }
      }
    }

    // Find tasks with no dependencies (roots)
    const rootTasks: typeof workflowPlan.tasks = [];
    const dependentTasks: typeof workflowPlan.tasks = [];

    for (const task of workflowPlan.tasks) {
      const taskId = task?.id ?? `task-${genUniqueId()}`;
      const hasDependencies = dependencyGraph.has(taskId) && dependencyGraph.get(taskId)!.size > 0;

      if (!hasDependencies) {
        rootTasks.push(task);
      } else {
        dependentTasks.push(task);
      }
    }

    // Process root tasks first
    let taskIndex = 0;
    for (const task of [...rootTasks, ...dependentTasks]) {
      const taskId = task?.id ?? `task-${genUniqueId()}`;
      const taskTitle = task?.title ?? '';
      const taskPrompt = task?.prompt ?? '';

      // Build selected toolsets metadata from task toolset ids
      const selectedToolsets: GenericToolset[] = [];
      if (Array.isArray(task.toolsets)) {
        for (const toolsetId of task.toolsets) {
          // Find the corresponding toolset from the available toolsets
          const toolset =
            toolsets?.find((t) => t.id === toolsetId) ||
            toolsets?.find((t) => t.toolset?.key === toolsetId);
          if (toolset) {
            selectedToolsets.push(toolset);
          }
        }
      }

      // Create connection filters for dependent tasks
      const connectTo: CanvasNodeFilter[] = [];
      if (Array.isArray(task.dependentTasks)) {
        for (const dependentTaskId of task.dependentTasks) {
          const dependentEntityId = taskIdToEntityId.get(dependentTaskId);
          if (dependentEntityId) {
            connectTo.push({
              type: 'skillResponse',
              entityId: dependentEntityId,
              handleType: 'source',
            });
          }
        }
      }

      // Get the pre-generated entity ID for this task
      const taskEntityId = taskIdToEntityId.get(taskId)!;

      // Replace agent mentions in prompt with real entity IDs
      // Now taskIdToEntityId contains all tasks, so all references will be replaced correctly
      const normalizedPrompt = replaceTaskAgentMentions(taskPrompt, taskIdToEntityId);

      // Calculate default position for non-auto-layout mode
      const defaultPosition = autoLayout
        ? undefined
        : {
            x: taskStartX,
            y: taskIndex * rowStepY,
          };

      taskIndex++;

      const nodeData: Partial<CanvasNode> = {
        type: 'skillResponse',
        position: defaultPosition,
        data: {
          title: taskTitle,
          editedTitle: taskTitle,
          entityId: taskEntityId,
          contentPreview: '',
          metadata: {
            query: normalizedPrompt,
            selectedToolsets,
            contextItems: [],
            status: 'init',
            modelInfo: defaultModel,
            taskId, // Store taskId for incremental editing mapping
          },
        },
      };

      // Use prepareAddNode to calculate proper position
      const { newNode } = prepareAddNode({
        node: nodeData,
        nodes: [...startNodes, ...nodes] as any[], // Cast to match expected type
        edges: edges as any[], // Cast to match expected type
        connectTo,
        autoLayout,
      });

      nodes.push(newNode);
      taskIdToNodeId.set(taskId, newNode.id);
    }

    // Phase 2: Create dependency edges
    for (const task of workflowPlan.tasks) {
      const taskId = task?.id ?? `task-${genUniqueId()}`;
      const taskNodeId = taskIdToNodeId.get(taskId);

      if (!taskNodeId) continue;

      // Create edges from dependent tasks to this task
      if (Array.isArray(task.dependentTasks)) {
        for (const dependentTaskId of task.dependentTasks) {
          const sourceNodeId = taskIdToNodeId.get(dependentTaskId);
          if (sourceNodeId && sourceNodeId !== taskNodeId) {
            // Check if edge already exists
            const edgeExists = edges.some(
              (edge) => edge.source === sourceNodeId && edge.target === taskNodeId,
            );

            if (!edgeExists) {
              edges.push({
                id: `edge-${genUniqueId()}`,
                source: sourceNodeId,
                target: taskNodeId,
                type: 'default',
              });
            }
          }
        }
      }
    }
  }

  return {
    nodes,
    edges,
    variables: workflowPlan.variables
      ?.map(planVariableToWorkflowVariable)
      .filter((v): v is WorkflowVariable => v !== null),
  };
};

/**
 * Variable operation returned from incremental changes for the caller to handle
 */
export interface VariableOperation {
  type: 'create' | 'update' | 'delete';
  variableId?: string;
  variable?: WorkflowVariable;
  data?: Partial<WorkflowVariable>;
}

/**
 * Result of applying incremental changes to canvas
 */
export interface IncrementalChangesResult {
  nodes: CanvasNode[];
  edges: RawCanvasData['edges'];
  affectedNodeIds: string[];
  variableOperations: VariableOperation[];
}

/**
 * Apply incremental patch operations to existing canvas data.
 * This function preserves unchanged nodes and only modifies affected ones.
 *
 * @param operations - Array of patch operations to apply
 * @param currentNodes - Current canvas nodes
 * @param currentEdges - Current canvas edges
 * @param toolsets - Available toolsets for node creation
 * @param options - Optional configuration
 * @returns Updated nodes, edges, and list of affected node IDs
 */
export const applyIncrementalChangesToCanvas = (
  operations: WorkflowPatchOperation[],
  currentNodes: CanvasNode[],
  currentEdges: RawCanvasData['edges'],
  toolsets: GenericToolset[],
  options?: { defaultModel?: ModelInfo },
): IncrementalChangesResult => {
  // Build taskId -> node mapping from current nodes
  const taskIdToNode = new Map<string, CanvasNode>();
  const taskIdToNodeId = new Map<string, string>();
  const taskIdToEntityId = new Map<string, string>();

  for (const node of currentNodes) {
    const metadata = (node.data as any)?.metadata;
    const taskId = metadata?.taskId;
    if (taskId) {
      taskIdToNode.set(taskId, node);
      taskIdToNodeId.set(taskId, node.id);
      taskIdToEntityId.set(taskId, (node.data as any)?.entityId);
    }
  }

  let nodes = [...currentNodes];
  let edges = [...currentEdges];
  const affectedNodeIds: string[] = [];
  const variableOperations: VariableOperation[] = [];

  for (const operation of operations) {
    const { op, title: _title, taskId, task, variableId, variable, data } = operation;

    switch (op) {
      case 'updateTitle': {
        // Title updates don't affect canvas nodes (title is used at plan level, not canvas)
        break;
      }

      case 'createTask': {
        if (!task) break;

        const newTaskId = task.id ?? `task-${genUniqueId()}`;
        const taskTitle = task.title ?? '';
        const taskPrompt = task.prompt ?? '';

        // Build selected toolsets metadata
        const selectedToolsets: GenericToolset[] = [];
        if (Array.isArray(task.toolsets)) {
          for (const toolsetId of task.toolsets) {
            const toolset =
              toolsets?.find((t) => t.id === toolsetId) ||
              toolsets?.find((t) => t.toolset?.key === toolsetId);
            if (toolset) {
              selectedToolsets.push(toolset);
            }
          }
        }

        // Create connection filters for dependent tasks
        const connectTo: CanvasNodeFilter[] = [];
        if (Array.isArray(task.dependentTasks)) {
          for (const dependentTaskId of task.dependentTasks) {
            const dependentEntityId = taskIdToEntityId.get(dependentTaskId);
            if (dependentEntityId) {
              connectTo.push({
                type: 'skillResponse',
                entityId: dependentEntityId,
                handleType: 'source',
              });
            }
          }
        }

        // Generate entity ID for the new node
        const taskEntityId = genNodeEntityId('skillResponse');
        taskIdToEntityId.set(newTaskId, taskEntityId);

        // Replace task agent mentions with actual entity IDs
        const normalizedPrompt = replaceTaskAgentMentions(taskPrompt, taskIdToEntityId);

        const nodeData: Partial<CanvasNode> = {
          type: 'skillResponse',
          data: {
            title: taskTitle,
            editedTitle: taskTitle,
            entityId: taskEntityId,
            contentPreview: '',
            metadata: {
              query: normalizedPrompt,
              selectedToolsets,
              contextItems: [],
              status: 'init',
              modelInfo: options?.defaultModel,
              taskId: newTaskId,
            },
          },
        };

        // Use prepareAddNode to calculate proper position
        const { newNode } = prepareAddNode({
          node: nodeData,
          nodes: nodes as any[],
          edges: edges as any[],
          connectTo,
          autoLayout: true,
        });

        nodes.push(newNode);
        taskIdToNode.set(newTaskId, newNode);
        taskIdToNodeId.set(newTaskId, newNode.id);
        affectedNodeIds.push(newNode.id);

        // Create edges from dependent tasks
        if (Array.isArray(task.dependentTasks)) {
          for (const dependentTaskId of task.dependentTasks) {
            const sourceNodeId = taskIdToNodeId.get(dependentTaskId);
            if (sourceNodeId && sourceNodeId !== newNode.id) {
              const edgeExists = edges.some(
                (edge) => edge.source === sourceNodeId && edge.target === newNode.id,
              );
              if (!edgeExists) {
                edges.push({
                  id: `edge-${genUniqueId()}`,
                  source: sourceNodeId,
                  target: newNode.id,
                  type: 'default',
                });
              }
            }
          }
        }
        break;
      }

      case 'updateTask': {
        if (!taskId || !data) break;

        const node = taskIdToNode.get(taskId);
        if (!node) break;

        // Create a deep copy of the node to avoid mutation
        // Using structuredClone for proper deep cloning (preserves types better than JSON.parse/stringify)
        const updatedNode = structuredClone(node) as CanvasNode;
        const nodeData = updatedNode.data as CanvasNode['data'] & {
          metadata?: Record<string, unknown>;
        };

        // Update title if provided
        if (data.title !== undefined) {
          nodeData.title = data.title;
          nodeData.editedTitle = data.title;
        }

        // Update metadata fields
        if (nodeData.metadata) {
          // Update prompt
          if (data.prompt !== undefined) {
            const normalizedPrompt = replaceTaskAgentMentions(data.prompt, taskIdToEntityId);
            nodeData.metadata.query = normalizedPrompt;
          }

          // Update toolsets
          if (data.toolsets !== undefined) {
            const selectedToolsets: GenericToolset[] = [];
            for (const toolsetId of data.toolsets) {
              const toolset =
                toolsets?.find((t) => t.id === toolsetId) ||
                toolsets?.find((t) => t.toolset?.key === toolsetId);
              if (toolset) {
                selectedToolsets.push(toolset);
              }
            }
            nodeData.metadata.selectedToolsets = selectedToolsets;
          }
        }

        // Replace node in the array
        nodes = nodes.map((n) => (n.id === node.id ? updatedNode : n));
        taskIdToNode.set(taskId, updatedNode);
        affectedNodeIds.push(node.id);

        // Handle dependency changes
        if (data.dependentTasks !== undefined) {
          // Remove old edges pointing to this node
          edges = edges.filter((edge) => edge.target !== node.id);

          // Create new edges for updated dependencies
          for (const dependentTaskId of data.dependentTasks) {
            const sourceNodeId = taskIdToNodeId.get(dependentTaskId);
            if (sourceNodeId && sourceNodeId !== node.id) {
              edges.push({
                id: `edge-${genUniqueId()}`,
                source: sourceNodeId,
                target: node.id,
                type: 'default',
              });
            }
          }
        }
        break;
      }

      case 'deleteTask': {
        if (!taskId) break;

        const node = taskIdToNode.get(taskId);
        if (!node) break;

        // Remove node from the array
        nodes = nodes.filter((n) => n.id !== node.id);

        // Remove all edges connected to this node
        edges = edges.filter((edge) => edge.source !== node.id && edge.target !== node.id);

        // Clean up mappings
        taskIdToNode.delete(taskId);
        taskIdToNodeId.delete(taskId);
        taskIdToEntityId.delete(taskId);
        break;
      }

      case 'createVariable': {
        if (variable) {
          const convertedVariable = planVariableToWorkflowVariable(variable);
          if (convertedVariable) {
            variableOperations.push({
              type: 'create',
              variable: convertedVariable,
            });
          }
        }
        break;
      }

      case 'updateVariable': {
        if (variableId && data) {
          // Convert value array to ensure proper typing
          const convertedValue: VariableValue[] | undefined = data.value?.map((v) => {
            const result: VariableValue = {
              type: (v?.type as 'text' | 'resource') ?? 'text',
              text: v?.text,
            };
            // Only include resource if it has the required fields
            if (v?.resource?.name && v?.resource?.fileType) {
              result.resource = {
                name: v.resource.name,
                fileType: v.resource.fileType as 'document' | 'image' | 'video' | 'audio',
              };
            }
            return result;
          });

          const updateData: Partial<WorkflowVariable> = {};
          if (data.name !== undefined) updateData.name = data.name;
          if (data.description !== undefined) updateData.description = data.description;
          if (data.variableType !== undefined) {
            updateData.variableType = data.variableType as 'string' | 'option' | 'resource';
          }
          if (data.required !== undefined) updateData.required = data.required;
          if (data.resourceTypes !== undefined) updateData.resourceTypes = data.resourceTypes;
          if (convertedValue !== undefined) updateData.value = convertedValue;

          variableOperations.push({
            type: 'update',
            variableId,
            data: updateData,
          });
        }
        break;
      }

      case 'deleteVariable': {
        if (variableId) {
          variableOperations.push({
            type: 'delete',
            variableId,
          });
        }
        break;
      }
    }
  }

  return {
    nodes,
    edges,
    affectedNodeIds,
    variableOperations,
  };
};
