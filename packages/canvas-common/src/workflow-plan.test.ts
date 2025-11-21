import { describe, it, expect } from 'vitest';
import { generateCanvasDataFromWorkflowPlan } from './workflow-plan';

// Helper to create a minimal task
const createTask = (
  id: string,
  title: string,
  prompt: string,
  options: {
    dependentTasks?: string[];
    toolsets?: string[];
  } = {},
) => ({
  id,
  title,
  prompt,
  ...options,
});

// Helper to create a workflow plan
const createWorkflowPlan = (
  tasks: any[],
  products: Array<{ id: string; type: any; title: string }> = [],
  variables: any[] = [],
) => ({
  tasks,
  products,
  variables,
});

// Helper to create available toolsets
const createToolsets = (
  toolsets: Array<{ id: string; name: string; type?: string; selectedTools?: string[] }>,
) =>
  toolsets.map((t) => ({
    id: t.id,
    name: t.name,
    type: (t.type ?? 'regular') as 'regular' | 'mcp',
    selectedTools: t.selectedTools ?? [],
  }));

describe('generateCanvasDataFromWorkflowPlan', () => {
  it('should return empty canvas data when workflow plan has no tasks', () => {
    const workflowPlan = createWorkflowPlan([]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result).toEqual({ nodes: [], edges: [], variables: [] });
  });

  it('should create task nodes with correct properties', () => {
    const task = createTask('task-1', 'Test Task', 'Test prompt');
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, [], { autoLayout: false });

    expect(result.nodes).toHaveLength(1);
    const taskNode = result.nodes[0];

    expect(taskNode.type).toBe('skillResponse');
    expect(taskNode.position).toEqual({ x: 0, y: 0 });
    expect(taskNode.data?.title).toBe('Test Task');
    expect(taskNode.data?.contentPreview).toBe('');
    expect(taskNode.data?.metadata?.query).toBe('Test prompt');
  });

  it('should create task nodes with toolsets metadata', () => {
    const toolsets = createToolsets([
      { id: 'toolset1', name: 'Toolset 1', selectedTools: ['tool1', 'tool2'] },
      { id: 'toolset2', name: 'Toolset 2', selectedTools: ['tool3'] },
    ]);
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      toolsets: ['toolset1', 'toolset2'],
    });
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, toolsets);

    const taskNode = result.nodes[0];
    expect(taskNode.data?.metadata?.selectedToolsets).toHaveLength(2);
    const selectedToolsets = taskNode.data?.metadata?.selectedToolsets as any[];
    expect(selectedToolsets[0]).toEqual({
      type: 'regular',
      id: 'toolset1',
      name: 'Toolset 1',
      selectedTools: ['tool1', 'tool2'],
    });
    expect(selectedToolsets[1]).toEqual({
      type: 'regular',
      id: 'toolset2',
      name: 'Toolset 2',
      selectedTools: ['tool3'],
    });
  });

  it('should handle empty toolsets array', () => {
    const task = createTask('task-1', 'Test Task', 'Test prompt', { toolsets: [] });
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    const taskNode = result.nodes[0];
    expect(taskNode.data?.metadata?.selectedToolsets).toEqual([]);
  });

  it('should filter out toolsets not found in available toolsets', () => {
    const availableToolsets = createToolsets([
      { id: 'valid', name: 'Valid Toolset', selectedTools: ['tool1'] },
    ]);
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      toolsets: ['valid', 'invalid'],
    });
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, availableToolsets);

    const taskNode = result.nodes[0];
    expect(taskNode.data?.metadata?.selectedToolsets).toHaveLength(1);
    const selectedToolsets = taskNode.data?.metadata?.selectedToolsets as any[];
    expect(selectedToolsets[0].id).toBe('valid');
  });

  it('should create edges from dependent tasks to tasks', () => {
    const task1 = createTask('task-1', 'Task 1', 'Prompt 1');
    const task2 = createTask('task-2', 'Task 2', 'Prompt 2', {
      dependentTasks: ['task-1'],
    });

    const workflowPlan = createWorkflowPlan([task1, task2]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.edges).toHaveLength(1); // 1 dependency edge from task1 to task2

    // Should have edge from task1 to task2 (dependent task)
    const taskDependencyEdge = result.edges.find(
      (e) => e.source === result.nodes[0].id && e.target === result.nodes[1].id,
    );
    expect(taskDependencyEdge).toBeDefined();
  });

  it('should position multiple tasks vertically', () => {
    const task1 = createTask('task-1', 'Task 1', 'Prompt 1');
    const task2 = createTask('task-2', 'Task 2', 'Prompt 2');
    const task3 = createTask('task-3', 'Task 3', 'Prompt 3');

    const workflowPlan = createWorkflowPlan([task1, task2, task3]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, [], { autoLayout: false });

    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[1].position).toEqual({ x: 0, y: 240 });
    expect(result.nodes[2].position).toEqual({ x: 0, y: 480 });
  });

  it('should handle missing task properties gracefully', () => {
    const task = {
      // Missing id, title, prompt
    };
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(1);
    const taskNode = result.nodes[0];

    expect(taskNode.data?.title).toBe('');
    expect(taskNode.data?.metadata?.query).toBe('');
  });

  it('should skip creating edges for invalid dependent tasks', () => {
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      dependentTasks: ['invalid-id'], // non-existent task id
    });
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    // Should only create the task node, no edges
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('should handle non-array dependentTasks gracefully', () => {
    const task = {
      id: 'task-1',
      title: 'Test Task',
      prompt: 'Test prompt',
      dependentTasks: 'not-an-array',
    };
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('should handle non-array toolsets gracefully', () => {
    const task = {
      id: 'task-1',
      title: 'Test Task',
      prompt: 'Test prompt',
      toolsets: 'not-an-array',
    };
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(1);
    const taskNode = result.nodes[0];
    expect(taskNode.data?.metadata?.selectedToolsets).toEqual([]);
  });

  it('should create complex workflow with multiple interconnected tasks', () => {
    // Task 1
    const task1 = createTask('research', 'Research Task', 'Research prompt');

    // Task 2 that depends on Task 1
    const task2 = createTask('presentation', 'Presentation Task', 'Create presentation', {
      dependentTasks: ['research'],
    });

    // Task 3 that depends on Task 2
    const task3 = createTask('review', 'Review Task', 'Review all outputs', {
      dependentTasks: ['presentation'],
    });

    const workflowPlan = createWorkflowPlan([task1, task2, task3]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    // Should have: 3 tasks only
    expect(result.nodes).toHaveLength(3);

    // Should have edges: research->presentation, presentation->review
    expect(result.edges).toHaveLength(2);

    // Verify all nodes are task nodes
    const taskNodes = result.nodes.filter((n) => n.type === 'skillResponse');
    expect(taskNodes).toHaveLength(3);

    // Verify edges connect tasks in dependency order
    const researchNode = result.nodes.find((n) => n.data?.title === 'Research Task');
    const presentationNode = result.nodes.find((n) => n.data?.title === 'Presentation Task');
    const reviewNode = result.nodes.find((n) => n.data?.title === 'Review Task');

    expect(researchNode).toBeDefined();
    expect(presentationNode).toBeDefined();
    expect(reviewNode).toBeDefined();

    // Check edges exist
    const researchToPresentationEdge = result.edges.find(
      (e) => e.source === researchNode?.id && e.target === presentationNode?.id,
    );
    const presentationToReviewEdge = result.edges.find(
      (e) => e.source === presentationNode?.id && e.target === reviewNode?.id,
    );

    expect(researchToPresentationEdge).toBeDefined();
    expect(presentationToReviewEdge).toBeDefined();
  });
});
