import { describe, it, expect } from 'vitest';
import { extractToolsetsWithNodes, purgeToolsets } from './tools';
import type { CanvasNode, GenericToolset } from '@refly/openapi-schema';

// Helper to create a minimal CanvasNode
const createNode = (id: string, type = 'document', metadata: Record<string, any> = {}) => ({
  id,
  type: type as any,
  position: { x: 0, y: 0 },
  data: {
    title: `Node ${id}`,
    entityId: id,
    metadata,
  },
});

// Helper to create a minimal GenericToolset
const createToolset = (id: string, name = `Toolset ${id}`) => ({
  id,
  name,
  tools: [],
});

// Helper to create a GenericToolset with sensitive data for testing
const createToolsetWithSensitiveData = (
  id: string,
  options: {
    name?: string;
    type?: 'regular' | 'mcp';
    withToolset?: boolean;
    withMcpServer?: boolean;
    customData?: Record<string, any>;
  } = {},
): GenericToolset => {
  const {
    name = `Toolset ${id}`,
    type = 'regular',
    withToolset = false,
    withMcpServer = false,
    customData = {},
  } = options;

  const toolset: GenericToolset = {
    id,
    name,
    type,
    selectedTools: [],
    ...customData,
  };

  if (withToolset) {
    toolset.toolset = {
      toolsetId: 'internal-toolset-id',
      name: 'Internal Toolset',
      authData: { apiKey: 'secret-key', token: 'auth-token' },
      config: { safe: 'config data' },
      definition: {
        key: 'test-toolset',
        descriptionDict: { en: 'Test toolset description' },
        tools: [],
      },
    };
  }

  if (withMcpServer) {
    toolset.mcpServer = {
      name: 'MCP Server',
      type: 'stdio',
      command: 'mcp-server',
      args: ['--config', 'config.json'],
      headers: { authorization: 'Bearer token123', 'x-api-key': 'api-key-456' },
      env: { API_SECRET: 'secret-env-var', DB_PASSWORD: 'db-pass' },
      config: { safe: 'server config' },
      enabled: true,
      isGlobal: false,
    };
  }

  return toolset;
};

describe('extractToolsetsWithNodes', () => {
  it('should return empty array when given empty nodes array', () => {
    const result = extractToolsetsWithNodes([]);
    expect(result).toEqual([]);
  });

  it('should return empty array when no skillResponse nodes exist', () => {
    const nodes = [
      createNode('1', 'document'),
      createNode('2', 'resource'),
      createNode('3', 'skill'),
    ];
    const result = extractToolsetsWithNodes(nodes);
    expect(result).toEqual([]);
  });

  it('should return empty array when skillResponse nodes have no selectedToolsets', () => {
    const nodes = [
      createNode('1', 'skillResponse', { query: 'test query' }),
      createNode('2', 'skillResponse', { resultId: '123' }),
    ];
    const result = extractToolsetsWithNodes(nodes);
    expect(result).toEqual([]);
  });

  it('should return empty array when skillResponse nodes have empty selectedToolsets', () => {
    const nodes = [createNode('1', 'skillResponse', { selectedToolsets: [] })];
    const result = extractToolsetsWithNodes(nodes);
    expect(result).toEqual([]);
  });

  it('should extract toolsets from single skillResponse node', () => {
    const toolset1 = createToolset('toolset-1', 'Search Tool');
    const node = createNode('node-1', 'skillResponse', {
      selectedToolsets: [toolset1],
    });

    const result = extractToolsetsWithNodes([node]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      toolset: toolset1,
      referencedNodes: [
        {
          id: 'node-1',
          entityId: 'node-1',
          title: 'Node node-1',
          type: 'skillResponse',
        },
      ],
    });
  });

  it('should extract multiple toolsets from single skillResponse node', () => {
    const toolset1 = createToolset('toolset-1', 'Search Tool');
    const toolset2 = createToolset('toolset-2', 'Calculator Tool');
    const node = createNode('node-1', 'skillResponse', {
      selectedToolsets: [toolset1, toolset2],
    });

    const result = extractToolsetsWithNodes([node]);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          toolset: toolset1,
          referencedNodes: [
            {
              id: 'node-1',
              entityId: 'node-1',
              title: 'Node node-1',
              type: 'skillResponse',
            },
          ],
        },
        {
          toolset: toolset2,
          referencedNodes: [
            {
              id: 'node-1',
              entityId: 'node-1',
              title: 'Node node-1',
              type: 'skillResponse',
            },
          ],
        },
      ]),
    );
  });

  it('should handle multiple nodes referencing the same toolset', () => {
    const toolset1 = createToolset('toolset-1', 'Search Tool');
    const node1 = createNode('node-1', 'skillResponse', {
      selectedToolsets: [toolset1],
    });
    const node2 = createNode('node-2', 'skillResponse', {
      selectedToolsets: [toolset1],
    });

    const result = extractToolsetsWithNodes([node1, node2]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      toolset: toolset1,
      referencedNodes: [
        {
          id: 'node-1',
          entityId: 'node-1',
          title: 'Node node-1',
          type: 'skillResponse',
        },
        {
          id: 'node-2',
          entityId: 'node-2',
          title: 'Node node-2',
          type: 'skillResponse',
        },
      ],
    });
  });

  it('should not add duplicate nodes to the same toolset', () => {
    const toolset1 = createToolset('toolset-1', 'Search Tool');
    const node = createNode('node-1', 'skillResponse', {
      selectedToolsets: [toolset1, toolset1], // Same toolset twice
    });

    const result = extractToolsetsWithNodes([node]);

    expect(result).toHaveLength(1);
    expect(result[0].referencedNodes).toHaveLength(1);
    expect(result[0].referencedNodes[0]).toEqual({
      id: 'node-1',
      entityId: 'node-1',
      title: 'Node node-1',
      type: 'skillResponse',
    });
  });

  it('should handle mixed node types and only process skillResponse nodes', () => {
    const toolset1 = createToolset('toolset-1', 'Search Tool');
    const nodes = [
      createNode('1', 'document'),
      createNode('2', 'skillResponse', { selectedToolsets: [toolset1] }),
      createNode('3', 'resource'),
      createNode('4', 'skillResponse', { selectedToolsets: [] }),
    ];

    const result = extractToolsetsWithNodes(nodes);

    expect(result).toHaveLength(1);
    expect(result[0].toolset).toEqual(toolset1);
    expect(result[0].referencedNodes).toHaveLength(1);
  });

  it('should handle nodes with custom titles', () => {
    const toolset1 = createToolset('toolset-1', 'Search Tool');
    const node: CanvasNode = {
      id: 'node-1',
      type: 'skillResponse' as any,
      position: { x: 0, y: 0 },
      data: {
        title: 'Custom Response Title',
        entityId: 'entity-123',
        metadata: {
          selectedToolsets: [toolset1],
        },
      },
    };

    const result = extractToolsetsWithNodes([node]);

    expect(result).toHaveLength(1);
    expect(result[0].referencedNodes[0]).toEqual({
      id: 'node-1',
      entityId: 'entity-123',
      title: 'Custom Response Title',
      type: 'skillResponse',
    });
  });

  it('should handle nodes with undefined title fallback', () => {
    const toolset1 = createToolset('toolset-1', 'Search Tool');
    const node: CanvasNode = {
      id: 'node-1',
      type: 'skillResponse' as any,
      position: { x: 0, y: 0 },
      data: {
        title: undefined as any,
        entityId: 'entity-123',
        metadata: {
          selectedToolsets: [toolset1],
        },
      },
    };

    const result = extractToolsetsWithNodes([node]);

    expect(result).toHaveLength(1);
    expect(result[0].referencedNodes[0]).toEqual({
      id: 'node-1',
      entityId: 'entity-123',
      title: 'Untitled',
      type: 'skillResponse',
    });
  });

  it('should handle complex scenario with multiple toolsets and nodes', () => {
    const toolset1 = createToolset('toolset-1', 'Search Tool');
    const toolset2 = createToolset('toolset-2', 'Calculator Tool');
    const toolset3 = createToolset('toolset-3', 'API Tool');

    const nodes = [
      // Node with multiple toolsets
      createNode('node-1', 'skillResponse', {
        selectedToolsets: [toolset1, toolset2],
      }),
      // Another node with overlapping toolset
      createNode('node-2', 'skillResponse', {
        selectedToolsets: [toolset2, toolset3],
      }),
      // Node with single toolset
      createNode('node-3', 'skillResponse', {
        selectedToolsets: [toolset1],
      }),
      // Non-skillResponse node (should be ignored)
      createNode('node-4', 'document'),
    ];

    const result = extractToolsetsWithNodes(nodes);

    expect(result).toHaveLength(3);

    // Check toolset1 has nodes 1 and 3
    const toolset1Result = result.find((r) => r.toolset.id === 'toolset-1');
    expect(toolset1Result?.referencedNodes).toHaveLength(2);
    expect(toolset1Result?.referencedNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'node-1' }),
        expect.objectContaining({ id: 'node-3' }),
      ]),
    );

    // Check toolset2 has nodes 1 and 2
    const toolset2Result = result.find((r) => r.toolset.id === 'toolset-2');
    expect(toolset2Result?.referencedNodes).toHaveLength(2);
    expect(toolset2Result?.referencedNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'node-1' }),
        expect.objectContaining({ id: 'node-2' }),
      ]),
    );

    // Check toolset3 has node 2
    const toolset3Result = result.find((r) => r.toolset.id === 'toolset-3');
    expect(toolset3Result?.referencedNodes).toHaveLength(1);
    expect(toolset3Result?.referencedNodes[0]).toEqual(expect.objectContaining({ id: 'node-2' }));
  });
});

describe('purgeToolsets', () => {
  it('should return empty array when input is not an array', () => {
    expect(purgeToolsets(null as any)).toEqual([]);
    expect(purgeToolsets(undefined as any)).toEqual([]);
    expect(purgeToolsets('not an array' as any)).toEqual([]);
    expect(purgeToolsets(123 as any)).toEqual([]);
    expect(purgeToolsets({} as any)).toEqual([]);
  });

  it('should return empty array when given empty array', () => {
    const result = purgeToolsets([]);
    expect(result).toEqual([]);
  });

  it('should return toolsets unchanged when they have no sensitive data', () => {
    const toolsets = [
      createToolsetWithSensitiveData('toolset-1', { name: 'Clean Toolset' }),
      createToolsetWithSensitiveData('toolset-2', { name: 'Another Clean Toolset' }),
    ];

    const result = purgeToolsets(toolsets);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(toolsets[0]);
    expect(result[1]).toEqual(toolsets[1]);
  });

  it('should purge sensitive data from toolset property', () => {
    const originalToolset = createToolsetWithSensitiveData('toolset-1', {
      name: 'Test Toolset',
      withToolset: true,
    });

    const result = purgeToolsets([originalToolset]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('toolset-1');
    expect(result[0].name).toBe('Test Toolset');
    expect(result[0].toolset).toBeDefined();
    expect(result[0].toolset?.toolsetId).toBe('internal-toolset-id');
    expect(result[0].toolset?.name).toBe('Internal Toolset');
    expect(result[0].toolset?.config).toEqual({ safe: 'config data' });

    // Sensitive data should be removed
    expect(result[0].toolset?.definition).toBeUndefined();
    expect(result[0].toolset?.authData).toBeUndefined();
  });

  it('should purge sensitive data from mcpServer property', () => {
    const originalToolset = createToolsetWithSensitiveData('toolset-1', {
      name: 'MCP Toolset',
      withMcpServer: true,
    });

    const result = purgeToolsets([originalToolset]);

    expect(result).toHaveLength(1);
    expect(result[0].mcpServer).toBeDefined();
    expect(result[0].mcpServer?.name).toBe('MCP Server');
    expect(result[0].mcpServer?.type).toBe('stdio');
    expect(result[0].mcpServer?.command).toBe('mcp-server');
    expect(result[0].mcpServer?.args).toEqual(['--config', 'config.json']);
    expect(result[0].mcpServer?.enabled).toBe(true);
    expect(result[0].mcpServer?.isGlobal).toBe(false);

    // Sensitive data should be removed
    expect(result[0].mcpServer?.headers).toBeUndefined();
    expect(result[0].mcpServer?.env).toBeUndefined();
  });

  it('should purge sensitive data from both toolset and mcpServer properties', () => {
    const originalToolset = createToolsetWithSensitiveData('toolset-1', {
      name: 'Combined Toolset',
      withToolset: true,
      withMcpServer: true,
    });

    const result = purgeToolsets([originalToolset]);

    expect(result).toHaveLength(1);

    // Check toolset purging
    expect(result[0].toolset).toBeDefined();
    expect(result[0].toolset?.definition).toBeUndefined();
    expect(result[0].toolset?.authData).toBeUndefined();
    expect(result[0].toolset?.config).toEqual({ safe: 'config data' });

    // Check mcpServer purging
    expect(result[0].mcpServer).toBeDefined();
    expect(result[0].mcpServer?.headers).toBeUndefined();
    expect(result[0].mcpServer?.env).toBeUndefined();
    expect(result[0].mcpServer?.config).toEqual({ safe: 'server config' });
  });

  it('should handle multiple toolsets with mixed sensitive data', () => {
    const toolsets = [
      // Toolset with only toolset property
      createToolsetWithSensitiveData('toolset-1', {
        name: 'Toolset Only',
        withToolset: true,
      }),
      // Toolset with only mcpServer property
      createToolsetWithSensitiveData('toolset-2', {
        name: 'MCP Only',
        withMcpServer: true,
      }),
      // Toolset with both properties
      createToolsetWithSensitiveData('toolset-3', {
        name: 'Both Properties',
        withToolset: true,
        withMcpServer: true,
      }),
      // Clean toolset
      createToolsetWithSensitiveData('toolset-4', {
        name: 'Clean Toolset',
      }),
    ];

    const result = purgeToolsets(toolsets);

    expect(result).toHaveLength(4);

    // Check toolset-1 (toolset only)
    expect(result[0].toolset?.definition).toBeUndefined();
    expect(result[0].toolset?.authData).toBeUndefined();
    expect(result[0].mcpServer).toBeUndefined();

    // Check toolset-2 (mcpServer only)
    expect(result[1].mcpServer?.headers).toBeUndefined();
    expect(result[1].mcpServer?.env).toBeUndefined();
    expect(result[1].toolset).toBeUndefined();

    // Check toolset-3 (both properties)
    expect(result[2].toolset?.definition).toBeUndefined();
    expect(result[2].toolset?.authData).toBeUndefined();
    expect(result[2].mcpServer?.headers).toBeUndefined();
    expect(result[2].mcpServer?.env).toBeUndefined();

    // Check toolset-4 (clean)
    expect(result[3]).toEqual(toolsets[3]);
  });

  it('should preserve all non-sensitive properties', () => {
    const originalToolset = createToolsetWithSensitiveData('toolset-1', {
      name: 'Complex Toolset',
      withToolset: true,
      withMcpServer: true,
      customData: {
        selectedTools: ['tool1', 'tool2'],
      },
    });

    const result = purgeToolsets([originalToolset]);

    expect(result).toHaveLength(1);
    const purged = result[0];

    // All non-sensitive properties should be preserved
    expect(purged.id).toBe('toolset-1');
    expect(purged.name).toBe('Complex Toolset');
    expect(purged.type).toBe('regular');
    expect(purged.selectedTools).toEqual(['tool1', 'tool2']);

    // Sensitive data should still be removed
    expect(purged.toolset?.definition).toBeUndefined();
    expect(purged.toolset?.authData).toBeUndefined();
    expect(purged.mcpServer?.headers).toBeUndefined();
    expect(purged.mcpServer?.env).toBeUndefined();
  });

  it('should create new objects and not mutate original toolsets', () => {
    const originalToolset = createToolsetWithSensitiveData('toolset-1', {
      name: 'Original Toolset',
      withToolset: true,
      withMcpServer: true,
    });

    const originalToolsetCopy = JSON.parse(JSON.stringify(originalToolset));
    const result = purgeToolsets([originalToolset]);

    // Original should remain unchanged
    expect(originalToolset).toEqual(originalToolsetCopy);

    // Result should be different objects
    expect(result[0]).not.toBe(originalToolset);
    expect(result[0].toolset).not.toBe(originalToolset.toolset);
    expect(result[0].mcpServer).not.toBe(originalToolset.mcpServer);
  });

  it('should handle toolsets without toolset or mcpServer properties', () => {
    const toolset: GenericToolset = {
      id: 'simple-toolset',
      name: 'Simple Toolset',
      type: 'regular',
      selectedTools: ['tool1'],
    };

    const result = purgeToolsets([toolset]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(toolset);
  });
});
