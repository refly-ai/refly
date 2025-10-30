import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasData, CanvasNodeType, WorkflowVariable } from '@refly/openapi-schema';
import {
  prepareNodeExecutions,
  WorkflowNode,
  updateContextItemsFromVariables,
  sortNodeExecutionsByExecutionOrder,
  WorkflowNodeExecution,
} from './workflow';
import { ResponseNodeMeta } from './types';
import { IContextItem } from '@refly-packages/common-types';

// Mock id generators for deterministic outputs
let sequences = {
  nodeIds: [] as string[],
  entityIds: [] as string[],
};

vi.mock('@refly/utils', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  let nodeIdIdx = 0;
  let entityIdIdx = 0;

  return {
    ...actual,
    genNodeID: vi.fn(() => sequences.nodeIds[nodeIdIdx++] ?? `N${nodeIdIdx}`),
    genNodeEntityId: vi.fn(() => sequences.entityIds[entityIdIdx++] ?? `E${entityIdIdx}`),
  };
});

// Helper function to set mock sequences
const setMockSequences = (s: {
  nodeIds?: string[];
  entityIds?: string[];
}) => {
  sequences = {
    nodeIds: s.nodeIds ?? [],
    entityIds: s.entityIds ?? [],
  };
};

describe('prepareNodeExecutions', () => {
  const buildCanvas = () => {
    const nodes = [
      {
        id: 'S',
        type: 'start',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          title: 'Start',
          entityId: 'entityStart',
          metadata: {
            contextItems: [],
          },
        },
      },
      {
        id: 'A',
        type: 'skillResponse' as CanvasNodeType,
        position: { x: 0, y: 0 },
        data: {
          title: 'Hello JavaScript world',
          entityId: 'entityA',
          metadata: {
            structuredData: { query: 'Hello @{type=var,id=v-topic,name=topic} world' },
            contextItems: [],
            modelInfo: {
              name: 'openai/gpt-5',
              providerItemId: 'pi-1',
              label: 'GPT-5',
              provider: 'openai',
              contextLimit: 1000,
              maxOutput: 1000,
            },
          } as ResponseNodeMeta,
        },
      },
      {
        id: 'B',
        type: 'document' as CanvasNodeType,
        position: { x: 0, y: 0 },
        data: {
          title: 'Test Document',
          entityId: 'entityB',
        },
      },
      {
        id: 'C',
        type: 'skillResponse' as CanvasNodeType,
        position: { x: 0, y: 0 },
        data: {
          title: 'Analyze test.pdf',
          entityId: 'entityC',
          metadata: {
            structuredData: {
              query: 'Analyze @{type=resource,id=resource1,name=test2.pdf} please',
            },
            contextItems: [
              {
                entityId: 'entityA',
                type: 'skillResponse',
                metadata: { withHistory: true },
              },
              { entityId: 'entityB', type: 'document' },
              { entityId: 'resource1', type: 'resource', title: 'test.pdf' },
            ],
            modelInfo: {
              name: 'openai/gpt-5-mini',
              providerItemId: 'pi-2',
              label: 'GPT-5 Mini',
              provider: 'openai',
              contextLimit: 1000,
              maxOutput: 1000,
            },
          } as ResponseNodeMeta,
        },
      },
    ];
    const edges = [
      { id: 'e0', source: 'S', target: 'A' },
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'A', target: 'C' },
    ];
    return { nodes, edges } as CanvasData;
  };

  const variables: WorkflowVariable[] = [
    {
      variableId: 'v-topic',
      name: 'topic',
      value: [{ type: 'text', text: 'TypeScript' }],
      variableType: 'string',
    },
    {
      variableId: 'v-doc',
      name: 'doc',
      value: [
        {
          type: 'resource',
          resource: {
            name: 'test2.pdf', // different name from test.pdf
            fileType: 'document',
            storageKey: 's1',
            entityId: 'resource1',
          },
        },
      ],
      variableType: 'resource',
    },
  ];

  beforeEach(() => {
    setMockSequences({
      nodeIds: ['N1', 'N2', 'N3', 'N4'],
      entityIds: ['E1', 'E2', 'E3', 'E4'],
    });
  });

  it('computes start nodes automatically and marks subtree nodes as waiting (isNewCanvas=false)', () => {
    const canvas = buildCanvas();
    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec1',
      canvasData: canvas,
      variables,
      isNewCanvas: false,
    });

    expect(startNodes).toEqual(['S']);
    expect(nodeExecutions).toEqual([
      {
        nodeId: 'S',
        nodeType: 'start',
        entityId: 'entityStart',
        childNodeIds: ['A'],
        parentNodeIds: [],
        connectTo: [],
        status: 'waiting',
        title: 'Start',
        node: {
          type: 'start',
          id: 'S',
          position: {
            x: 0,
            y: 0,
          },
          data: {
            title: 'Start',
            entityId: 'entityStart',
            metadata: {
              contextItems: [],
            },
          },
        },
      },
      {
        nodeId: 'A',
        nodeType: 'skillResponse',
        childNodeIds: ['B', 'C'],
        parentNodeIds: ['S'],
        originalQuery: 'Hello @{type=var,id=v-topic,name=topic} world',
        processedQuery: 'Hello TypeScript world',
        status: 'waiting',
        title: 'Hello TypeScript world',
        connectTo: [
          {
            type: 'start',
            entityId: 'entityStart',
            handleType: 'source',
          },
        ],
        entityId: 'entityA',
        resultHistory: [],
        node: {
          data: {
            entityId: 'entityA',
            metadata: {
              contextItems: [],
              structuredData: {
                query: 'Hello @{type=var,id=v-topic,name=topic} world',
              },
              modelInfo: {
                name: 'openai/gpt-5',
                providerItemId: 'pi-1',
                label: 'GPT-5',
                provider: 'openai',
                contextLimit: 1000,
                maxOutput: 1000,
              },
            },
            title: 'Hello TypeScript world',
          },
          id: 'A',
          position: {
            x: 0,
            y: 0,
          },
          type: 'skillResponse',
        },
      },
      {
        nodeId: 'B',
        nodeType: 'document',
        childNodeIds: ['C'],
        parentNodeIds: ['A'],
        entityId: 'entityB',
        status: 'waiting',
        title: 'Test Document',
        connectTo: [
          {
            entityId: 'entityA',
            handleType: 'source',
            type: 'skillResponse',
          },
        ],

        node: {
          data: {
            entityId: 'entityB',
            title: 'Test Document',
          },
          id: 'B',
          position: {
            x: 0,
            y: 0,
          },
          type: 'document',
        },
      },
      {
        nodeId: 'C',
        nodeType: 'skillResponse',
        originalQuery: 'Analyze @{type=resource,id=resource1,name=test2.pdf} please',
        parentNodeIds: ['B', 'A'],
        processedQuery: 'Analyze @test2.pdf please',
        status: 'waiting',
        title: 'Analyze @test2.pdf please',
        childNodeIds: [],
        entityId: 'entityC',
        connectTo: [
          {
            entityId: 'entityB',
            handleType: 'source',
            type: 'document',
          },
          {
            entityId: 'entityA',
            handleType: 'source',
            type: 'skillResponse',
          },
        ],
        resultHistory: [
          {
            title: 'Hello TypeScript world',
            resultId: 'entityA',
          },
        ],
        node: {
          data: {
            entityId: 'entityC',
            metadata: {
              structuredData: {
                query: 'Analyze @{type=resource,id=resource1,name=test2.pdf} please',
              },
              contextItems: [
                {
                  entityId: 'entityA',
                  type: 'skillResponse',
                  metadata: {
                    withHistory: true,
                  },
                },
                {
                  entityId: 'entityB',
                  type: 'document',
                },
                {
                  entityId: 'resource1',
                  type: 'resource',
                  title: 'test2.pdf',
                },
              ],
              modelInfo: {
                name: 'openai/gpt-5-mini',
                providerItemId: 'pi-2',
                label: 'GPT-5 Mini',
                provider: 'openai',
                contextLimit: 1000,
                maxOutput: 1000,
              },
            },
            title: 'Analyze @test2.pdf please',
          },
          id: 'C',
          position: {
            x: 0,
            y: 0,
          },
          type: 'skillResponse',
        },
      },
    ] as WorkflowNode[]);
  });

  it('uses provided startNodes when isNewCanvas=false', () => {
    const canvas = buildCanvas();
    const { startNodes } = prepareNodeExecutions({
      executionId: 'exec3',
      canvasData: canvas,
      variables,
      startNodes: ['C'], // This should be used when isNewCanvas=false
      isNewCanvas: false,
    });

    expect(startNodes).toEqual(['C']);
  });

  it('ignores provided startNodes and auto-detects root nodes when isNewCanvas=true', () => {
    const canvas = buildCanvas();
    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec2',
      canvasData: canvas,
      variables,
      startNodes: ['B'], // This should be ignored when isNewCanvas=true
      isNewCanvas: true,
    });

    // startNodes should be auto-detected (node A has no parents), mapped to new id N1
    expect(startNodes).toEqual(['N1']);
    expect(nodeExecutions).toEqual([
      {
        nodeId: 'N1',
        nodeType: 'start',
        title: 'Start',
        parentNodeIds: [],
        status: 'waiting',
        childNodeIds: ['N2'],
        connectTo: [],
        entityId: 'E1',
        node: {
          data: {
            contentPreview: '',
            entityId: 'E1',
            metadata: {
              contextItems: [],
            },
            title: 'Start',
          },
          id: 'N1',
          position: {
            x: 0,
            y: 0,
          },
          type: 'start',
        },
      },
      {
        nodeId: 'N2',
        nodeType: 'skillResponse',
        title: 'Hello TypeScript world',
        originalQuery: 'Hello @{type=var,id=v-topic,name=topic} world',
        parentNodeIds: ['N1'],
        processedQuery: 'Hello TypeScript world',
        resultHistory: [],
        status: 'waiting',
        childNodeIds: ['N3', 'N4'],
        entityId: 'E2',
        connectTo: [
          {
            entityId: 'E1',
            handleType: 'source',
            type: 'start',
          },
        ],
        node: {
          data: {
            contentPreview: '',
            entityId: 'E2',
            metadata: {
              contextItems: [],
              modelInfo: {
                contextLimit: 1000,
                label: 'GPT-5',
                maxOutput: 1000,
                name: 'openai/gpt-5',
                provider: 'openai',
                providerItemId: 'pi-1',
              },
              structuredData: {
                query: 'Hello @{type=var,id=v-topic,name=topic} world',
              },
            },
            title: 'Hello TypeScript world',
          },
          id: 'N2',
          position: {
            x: 0,
            y: 0,
          },
          type: 'skillResponse',
        },
      },
      {
        nodeId: 'N3',
        nodeType: 'document',
        parentNodeIds: ['N2'],
        status: 'waiting',
        title: 'Test Document',
        childNodeIds: ['N4'],
        connectTo: [
          {
            entityId: 'E2',
            handleType: 'source',
            type: 'skillResponse',
          },
        ],
        entityId: 'E3',
        node: {
          data: {
            entityId: 'E3',
            title: 'Test Document',
            contentPreview: '',
          },
          id: 'N3',
          position: {
            x: 0,
            y: 0,
          },
          type: 'document',
        },
      },
      {
        nodeId: 'N4',
        nodeType: 'skillResponse',
        originalQuery: 'Analyze @{type=resource,id=resource1,name=test2.pdf} please',
        parentNodeIds: ['N3', 'N2'],
        processedQuery: 'Analyze @test2.pdf please',
        resultHistory: [
          {
            title: 'Hello TypeScript world',
            resultId: 'E2',
          },
        ],
        status: 'waiting',
        title: 'Analyze @test2.pdf please',
        childNodeIds: [],
        connectTo: [
          {
            entityId: 'E3',
            handleType: 'source',
            type: 'document',
          },
          {
            entityId: 'E2',
            handleType: 'source',
            type: 'skillResponse',
          },
        ],
        entityId: 'E4',
        node: {
          data: {
            contentPreview: '',
            entityId: 'E4',
            metadata: {
              contextItems: [
                {
                  entityId: 'E2',
                  metadata: {
                    withHistory: true,
                  },
                  type: 'skillResponse',
                },
                {
                  entityId: 'E3',
                  type: 'document',
                },
                {
                  entityId: 'resource1',
                  type: 'resource',
                  title: 'test2.pdf',
                },
              ],
              modelInfo: {
                contextLimit: 1000,
                label: 'GPT-5 Mini',
                maxOutput: 1000,
                name: 'openai/gpt-5-mini',
                provider: 'openai',
                providerItemId: 'pi-2',
              },
              structuredData: {
                query: 'Analyze @{type=resource,id=resource1,name=test2.pdf} please',
              },
            },
            title: 'Analyze @test2.pdf please',
          },
          id: 'N4',
          position: {
            x: 0,
            y: 0,
          },
          type: 'skillResponse',
        },
      },
    ] as WorkflowNode[]);
  });

  it('marks skill nodes as finished regardless of subtree membership (isNewCanvas=false)', () => {
    setMockSequences({
      nodeIds: ['N1', 'N2', 'N3', 'N4'],
      entityIds: ['E1', 'E2', 'E3', 'E4'],
    });
    const canvasWithSkill = {
      nodes: [
        {
          id: 'S',
          type: 'start',
          position: { x: 0, y: 0 },
          data: {
            title: 'Start',
            entityId: 'entityStart',
            metadata: { contextItems: [] },
          },
        },
        {
          id: 'SKILL1',
          type: 'skill' as CanvasNodeType,
          position: { x: 0, y: 0 },
          data: {
            title: 'Translation Skill',
            entityId: 'entitySkill1',
            metadata: { contextItems: [] },
          },
        },
        {
          id: 'A',
          type: 'skillResponse' as CanvasNodeType,
          position: { x: 0, y: 0 },
          data: {
            title: 'Hello world',
            entityId: 'entityA',
            metadata: {
              structuredData: { query: 'Hello world' },
              contextItems: [],
              modelInfo: {
                name: 'openai/gpt-5',
                providerItemId: 'pi-1',
                label: 'GPT-5',
                provider: 'openai',
                contextLimit: 1000,
                maxOutput: 1000,
              },
            } as ResponseNodeMeta,
          },
        },
        {
          id: 'SKILL2',
          type: 'skill' as CanvasNodeType,
          position: { x: 0, y: 0 },
          data: {
            title: 'Summary Skill',
            entityId: 'entitySkill2',
            metadata: { contextItems: [] },
          },
        },
      ],
      edges: [
        { id: 'e0', source: 'S', target: 'SKILL1' },
        { id: 'e1', source: 'SKILL1', target: 'A' },
        { id: 'e2', source: 'A', target: 'SKILL2' },
      ],
    } as CanvasData;

    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec-skill',
      canvasData: canvasWithSkill,
      variables,
      isNewCanvas: false,
    });

    expect(startNodes).toEqual(['S']);

    // Verify skill nodes get 'finish' status
    const skill1Node = nodeExecutions.find((n) => n.nodeId === 'SKILL1');
    const skill2Node = nodeExecutions.find((n) => n.nodeId === 'SKILL2');

    expect(skill1Node?.status).toBe('finish');
    expect(skill2Node?.status).toBe('finish');

    // Verify other nodes get 'waiting' status (they're in the subtree)
    const startNode = nodeExecutions.find((n) => n.nodeId === 'S');
    const responseNode = nodeExecutions.find((n) => n.nodeId === 'A');

    expect(startNode?.status).toBe('waiting');
    expect(responseNode?.status).toBe('waiting');
  });

  it('marks skill nodes as finished in isNewCanvas=true mode', () => {
    setMockSequences({
      nodeIds: ['N1', 'N2', 'N3', 'N4'],
      entityIds: ['E1', 'E2', 'E3', 'E4'],
    });
    const canvasWithSkill = {
      nodes: [
        {
          id: 'SKILL1',
          type: 'skill' as CanvasNodeType,
          position: { x: 0, y: 0 },
          data: {
            title: 'Translation Skill',
            entityId: 'entitySkill1',
            metadata: { contextItems: [] },
          },
        },
        {
          id: 'A',
          type: 'skillResponse' as CanvasNodeType,
          position: { x: 0, y: 0 },
          data: {
            title: 'Hello world',
            entityId: 'entityA',
            metadata: {
              structuredData: { query: 'Hello world' },
              contextItems: [],
              modelInfo: {
                name: 'openai/gpt-5',
                providerItemId: 'pi-1',
                label: 'GPT-5',
                provider: 'openai',
                contextLimit: 1000,
                maxOutput: 1000,
              },
            } as ResponseNodeMeta,
          },
        },
      ],
      edges: [{ id: 'e0', source: 'SKILL1', target: 'A' }],
    } as CanvasData;

    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec-skill-new-canvas',
      canvasData: canvasWithSkill,
      variables,
      isNewCanvas: true,
    });

    expect(startNodes).toEqual(['N5']); // SKILL1 becomes N5

    // Verify skill node gets 'finish' status even in new canvas mode
    const skillNode = nodeExecutions.find((n) => n.nodeType === 'skill');
    expect(skillNode?.status).toBe('finish');

    // Verify other nodes in subtree get 'waiting' status
    const responseNode = nodeExecutions.find((n) => n.nodeType === 'skillResponse');
    expect(responseNode?.status).toBe('waiting');
  });
});

describe('updateContextItemsFromVariables', () => {
  it('returns original context items when variables empty or query has no references', () => {
    const contextItems: IContextItem[] = [{ entityId: 'existing', type: 'document' }];
    const variables: WorkflowVariable[] = [];

    expect(updateContextItemsFromVariables(contextItems, variables)).toEqual(contextItems);
    expect(updateContextItemsFromVariables(contextItems, variables)).toEqual(contextItems);
  });

  it('ignores non-resource variables', () => {
    const contextItems: IContextItem[] = [];
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'textVar',
        value: [{ type: 'text', text: 'hello' }],
        variableType: 'string',
      },
    ];

    expect(updateContextItemsFromVariables(contextItems, variables)).toEqual([]);
  });

  it('handles multiple resource variables in query', () => {
    const contextItems: IContextItem[] = [
      { entityId: 'resource1', type: 'resource', title: 'doc1.pdf' },
      { entityId: 'resource2', type: 'resource', title: 'doc2.pdf' },
    ];
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'doc1',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'doc1.pdf',
              fileType: 'document',
              storageKey: 's1',
              entityId: 'resource1',
            },
          },
        ],
        variableType: 'resource',
      },
      {
        variableId: 'v2',
        name: 'doc2',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'doc2.pdf',
              fileType: 'document',
              storageKey: 's2',
              entityId: 'resource2',
            },
          },
        ],
        variableType: 'resource',
      },
    ];

    const result = updateContextItemsFromVariables(contextItems, variables);
    expect(result).toEqual([
      { entityId: 'resource1', type: 'resource', title: 'doc1.pdf' },
      { entityId: 'resource2', type: 'resource', title: 'doc2.pdf' },
    ]);
  });

  it('skips resource variables without entityId', () => {
    const contextItems: IContextItem[] = [];
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'doc',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'test.pdf',
              fileType: 'document',
              storageKey: 's1',
              // No entityId
            },
          },
        ],
        variableType: 'resource',
      },
    ];

    const result = updateContextItemsFromVariables(contextItems, variables);
    expect(result).toEqual([]);
  });

  it('updates existing resource context item title to variable name when entityId matches', () => {
    const contextItems: IContextItem[] = [
      { entityId: 'resource1', type: 'resource', title: 'existing.pdf' },
    ];
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'doc',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'test.pdf',
              fileType: 'document',
              storageKey: 's1',
              entityId: 'resource1',
            },
          },
        ],
        variableType: 'resource',
      },
    ];

    const result = updateContextItemsFromVariables(contextItems, variables);
    expect(result).toEqual([{ entityId: 'resource1', type: 'resource', title: 'test.pdf' }]);
  });

  it('handles non-ASCII variable names', () => {
    const contextItems: IContextItem[] = [
      {
        entityId: 'resource1',
        type: 'resource',
      },
    ];
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: '文档',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'test.pdf',
              fileType: 'document',
              storageKey: 's1',
              entityId: 'resource1',
            },
          },
        ],
        variableType: 'resource',
      },
    ];

    const result = updateContextItemsFromVariables(contextItems, variables);
    expect(result).toEqual([{ entityId: 'resource1', type: 'resource', title: 'test.pdf' }]);
  });

  it('updates multiple existing resources with different variable names', () => {
    const contextItems: IContextItem[] = [
      { entityId: 'resource1', type: 'resource', title: 'old_name1.pdf' },
      { entityId: 'resource2', type: 'resource', title: 'old_name2.pdf' },
      { entityId: 'resource3', type: 'resource', title: 'old_name3.pdf' },
    ];
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'doc1',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'test1.pdf',
              fileType: 'document',
              storageKey: 's1',
              entityId: 'resource1',
            },
          },
        ],
        variableType: 'resource',
      },
      {
        variableId: 'v2',
        name: 'doc2',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'test2.pdf',
              fileType: 'document',
              storageKey: 's2',
              entityId: 'resource2',
            },
          },
        ],
        variableType: 'resource',
      },
    ];

    const result = updateContextItemsFromVariables(contextItems, variables);
    expect(result).toEqual([
      { entityId: 'resource1', type: 'resource', title: 'test1.pdf' },
      { entityId: 'resource2', type: 'resource', title: 'test2.pdf' },
      { entityId: 'resource3', type: 'resource', title: 'old_name3.pdf' },
    ]);
  });
});

describe('sortNodeExecutionsByExecutionOrder', () => {
  // Helper function to create mock node executions
  const createNodeExecution = (
    nodeId: string,
    parentNodeIds: string[] = [],
  ): WorkflowNodeExecution => ({
    nodeId,
    parentNodeIds: JSON.stringify(parentNodeIds),
    childNodeIds: JSON.stringify([]),
  });

  it('sorts nodes with no dependencies in original order', () => {
    const nodeExecutions = [
      createNodeExecution('C'),
      createNodeExecution('A'),
      createNodeExecution('B'),
    ];

    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    const nodeIds = result.map((n) => n.nodeId);

    expect(nodeIds).toEqual(['A', 'B', 'C']);
  });

  it('sorts nodes with simple parent-child relationship', () => {
    const nodeExecutions = [
      createNodeExecution('B', ['A']),
      createNodeExecution('A'),
      createNodeExecution('C', ['B']),
    ];

    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    const nodeIds = result.map((n) => n.nodeId);

    expect(nodeIds).toEqual(['A', 'B', 'C']);
  });

  it('sorts nodes with complex dependency graph', () => {
    // A -> B -> D
    // A -> C -> D
    // E -> F
    const nodeExecutions = [
      createNodeExecution('D', ['B', 'C']),
      createNodeExecution('C', ['A']),
      createNodeExecution('B', ['A']),
      createNodeExecution('A'),
      createNodeExecution('F', ['E']),
      createNodeExecution('E'),
    ];

    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    const nodeIds = result.map((n) => n.nodeId);

    // A should come before B and C
    expect(nodeIds.indexOf('A')).toBeLessThan(nodeIds.indexOf('B'));
    expect(nodeIds.indexOf('A')).toBeLessThan(nodeIds.indexOf('C'));

    // B and C should come before D
    expect(nodeIds.indexOf('B')).toBeLessThan(nodeIds.indexOf('D'));
    expect(nodeIds.indexOf('C')).toBeLessThan(nodeIds.indexOf('D'));

    // E should come before F
    expect(nodeIds.indexOf('E')).toBeLessThan(nodeIds.indexOf('F'));
  });

  it('handles nodes with multiple parents correctly', () => {
    // A -> C
    // B -> C
    const nodeExecutions = [
      createNodeExecution('C', ['A', 'B']),
      createNodeExecution('A'),
      createNodeExecution('B'),
    ];

    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    const nodeIds = result.map((n) => n.nodeId);

    // Both A and B should come before C
    expect(nodeIds.indexOf('A')).toBeLessThan(nodeIds.indexOf('C'));
    expect(nodeIds.indexOf('B')).toBeLessThan(nodeIds.indexOf('C'));
  });

  it('handles empty array', () => {
    const result = sortNodeExecutionsByExecutionOrder([]);
    expect(result).toEqual([]);
  });

  it('handles single node', () => {
    const nodeExecutions = [createNodeExecution('A')];
    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    expect(result).toEqual(nodeExecutions);
  });

  it('handles nodes with null parentNodeIds', () => {
    const nodeExecutions = [
      { nodeId: 'A', parentNodeIds: null, childNodeIds: null },
      { nodeId: 'B', parentNodeIds: null, childNodeIds: null },
    ];

    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    const nodeIds = result.map((n) => n.nodeId);

    expect(nodeIds).toEqual(['A', 'B']);
  });

  it('handles nodes with empty parentNodeIds string', () => {
    const nodeExecutions = [
      { nodeId: 'A', parentNodeIds: '[]', childNodeIds: '[]' },
      { nodeId: 'B', parentNodeIds: '[]', childNodeIds: '[]' },
    ];

    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    const nodeIds = result.map((n) => n.nodeId);

    expect(nodeIds).toEqual(['A', 'B']);
  });

  it('handles circular dependencies gracefully', () => {
    // A -> B -> A (circular)
    const nodeExecutions = [createNodeExecution('A', ['B']), createNodeExecution('B', ['A'])];

    // Should not throw and should return both nodes
    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.nodeId)).toContain('A');
    expect(result.map((n) => n.nodeId)).toContain('B');
  });

  it('handles missing parent nodes gracefully', () => {
    // A references non-existent parent X
    const nodeExecutions = [createNodeExecution('A', ['X']), createNodeExecution('B')];

    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    const nodeIds = result.map((n) => n.nodeId);

    // Should still sort correctly, ignoring missing parent
    expect(nodeIds).toEqual(['A', 'B']);
  });

  it('maintains stable sort for nodes with same dependencies', () => {
    // Both B and C depend on A, but B should come before C due to alphabetical order
    const nodeExecutions = [
      createNodeExecution('C', ['A']),
      createNodeExecution('B', ['A']),
      createNodeExecution('A'),
    ];

    const result = sortNodeExecutionsByExecutionOrder(nodeExecutions);
    const nodeIds = result.map((n) => n.nodeId);

    expect(nodeIds).toEqual(['A', 'B', 'C']);
  });
});
