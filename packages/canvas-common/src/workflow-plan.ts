import { z } from 'zod/v3';
import {
  GenericToolset,
  RawCanvasData,
  CanvasNode,
  WorkflowVariable,
  WorkflowTask,
  WorkflowPlan,
  ModelInfo,
} from '@refly/openapi-schema';
import { genNodeEntityId, genUniqueId } from '@refly/utils';
import { CanvasNodeFilter } from './types';
import { prepareAddNode } from './utils';

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
    .enum(['string', 'resource'])
    .describe('Variable type: string for text input, resource for file upload')
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
  variableType: z.enum(['string', 'resource']).optional().describe('New variable type'),
  name: z.string().optional().describe('New variable name'),
  description: z.string().optional().describe('New variable description'),
  required: z.boolean().optional().describe('Whether this variable is required'),
  resourceTypes: z
    .array(z.enum(['document', 'image', 'audio', 'video']))
    .optional()
    .describe('New accepted resource types'),
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
export type WorkflowPatchOperation = z.infer<typeof workflowPatchOperationSchema>;
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

export const planVariableToWorkflowVariable = (
  planVariable: WorkflowVariable,
): WorkflowVariable => {
  return {
    variableId: planVariable.variableId,
    variableType: planVariable.variableType as 'string' | 'option' | 'resource',
    name: planVariable.name,
    value: planVariable.value?.map((value) => ({
      type: value?.type as 'text' | 'resource',
      text: value?.text,
      // Only include resource if it has the required fields
      ...(value?.resource?.name && value?.resource?.fileType
        ? {
            resource: {
              name: value.resource.name,
              fileType: value.resource.fileType,
            },
          }
        : {}),
    })),
    description: planVariable.description,
    required: planVariable.required ?? false,
    resourceTypes: planVariable.resourceTypes,
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

      // Create the node data for prepareAddNode
      const taskEntityId = genNodeEntityId('skillResponse');

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
            query: taskPrompt,
            selectedToolsets,
            contextItems: [],
            status: 'init',
            modelInfo: defaultModel,
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
      taskIdToEntityId.set(taskId, taskEntityId);
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
    variables: workflowPlan.variables?.map(planVariableToWorkflowVariable),
  };
};
