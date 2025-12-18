import { z } from 'zod/v3';
import {
  GenericToolset,
  RawCanvasData,
  CanvasNode,
  WorkflowVariable,
  ModelInfo,
} from '@refly/openapi-schema';
import { genNodeEntityId, genUniqueId } from '@refly/utils';
import { CanvasNodeFilter } from './types';
import { prepareAddNode } from './utils';

export const workflowPlanSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string().describe('Unique ID for the task'),
        title: z.string().describe('Display title for the task'),
        prompt: z.string().describe('The prompt or instruction for this task'),
        dependentTasks: z
          .array(z.string().describe('Task ID'))
          .optional()
          .describe('Tasks that must be executed before this task'),
        toolsets: z
          .array(z.string().describe('Toolset ID'))
          .describe('Toolsets selected for this task'),
      }),
    )
    .describe('Array of workflow tasks to be executed'),
  variables: z
    .array(
      z.object({
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
        value: z
          .array(
            z.object({
              type: z
                .enum(['text', 'resource'])
                .describe('Value type: text for string variables, resource for file uploads')
                .default('text'),
              text: z.string().optional().describe('Text value (for text type)'),
              resource: z
                .object({
                  name: z.string().describe('Resource file name'),
                  fileType: z
                    .enum(['document', 'image', 'audio', 'video'])
                    .describe('Resource file type'),
                })
                .optional()
                .describe('Resource value (for resource type)'),
            }),
          )
          .describe('Variable values'),
      }),
    )
    .describe('Array of variables defined for the workflow'),
});

export type WorkflowPlan = z.infer<typeof workflowPlanSchema>;

// Enhanced parsing function with detailed error reporting
export type ParseWorkflowPlanResult = {
  success: boolean;
  data?: WorkflowPlan;
  error?: string;
};

export const parseWorkflowPlan = (data: unknown): ParseWorkflowPlanResult => {
  const result = workflowPlanSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
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
  planVariable: WorkflowPlan['variables'][number],
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
