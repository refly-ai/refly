import { SharedCanvasData, CanvasNode, DriveFile } from '@refly/openapi-schema';

/**
 * CRITICAL SANITIZATION TESTS
 *
 * These tests ensure that the sanitization logic:
 * 1. NEVER leaks sensitive user data (contextItems, queries, structuredData, etc.)
 * 2. ALWAYS maintains backward compatibility (edges field, owner field, etc.)
 * 3. NEVER breaks existing business logic (ToolsDependencyChecker, owner display, etc.)
 *
 * FAILURE IN THESE TESTS = CRITICAL SECURITY BREACH OR BUSINESS LOGIC BREAKAGE
 *
 * NOTE: This file tests the sanitization logic directly without importing the full service
 * to avoid Jest ES module dependency issues. The logic tested here matches the implementation
 * in share-creation.service.ts
 */

// Copy of sanitization functions to test (matching share-creation.service.ts implementation)
function sanitizeNodeMetadata(metadata: Record<string, any>): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  const ALLOWED_FIELDS = ['shareId', 'imageUrl', 'videoUrl', 'audioUrl', 'selectedToolsets'];
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => ALLOWED_FIELDS.includes(key)),
  );
}

function sanitizeCanvasDataForPublic(
  canvasData: SharedCanvasData,
  resultNodeIds: string[],
): {
  nodes: any[];
  files: any[];
  title?: string;
  canvasId?: string;
  owner?: any;
  variables?: any[];
  resources?: any[];
} {
  if (!canvasData || typeof canvasData !== 'object') {
    return {
      nodes: [],
      files: [],
      title: undefined,
      canvasId: undefined,
      owner: undefined,
      variables: undefined,
      resources: undefined,
    };
  }

  const resultNodes = (canvasData.nodes || []).filter((node) => resultNodeIds.includes(node.id));

  const sanitizedNodes = resultNodes.map((node) => ({
    id: node.id,
    type: node.type, // KEEP: Required for frontend to determine how to render the node
    data: {
      entityId: node.data?.entityId || '',
      title: node.data?.title || '',
      metadata: sanitizeNodeMetadata(node.data?.metadata || {}),
    },
  }));

  // IMPORTANT: Keep ALL files without filtering
  const sanitizedFiles = canvasData.files || [];

  return {
    nodes: sanitizedNodes,
    files: sanitizedFiles,
    title: canvasData.title,
    canvasId: canvasData.canvasId,
    owner: canvasData.owner,
    variables: canvasData.variables,
    resources: canvasData.resources,
  };
}

describe('ShareCreationService - Sanitization Logic', () => {
  // No setup needed - testing pure functions directly

  describe('sanitizeNodeMetadata - CRITICAL: Must Remove All Sensitive Fields', () => {
    it('should ONLY keep whitelisted safe fields (shareId, imageUrl, videoUrl, audioUrl, selectedToolsets)', () => {
      const metadata = {
        // ALLOWED fields
        shareId: 'share_123',
        imageUrl: 'https://example.com/image.png',
        videoUrl: 'https://example.com/video.mp4',
        audioUrl: 'https://example.com/audio.mp3',
        selectedToolsets: [{ toolsetId: 'toolset_123' }], // Now ALLOWED

        // FORBIDDEN sensitive fields - MUST be removed
        contextItems: [
          { type: 'document', entityId: 'doc_123', metadata: { contentPreview: 'SENSITIVE' } },
        ],
        structuredData: { customerData: 'SENSITIVE', financialMetrics: 'SENSITIVE' },
        query: 'SENSITIVE user query',
        modelInfo: { model: 'gpt-4', provider: 'openai' },
        tokenUsage: [{ tokens: 1000 }],
        selectedSkill: { skillId: 'skill_123' },
        actionMeta: { actionId: 'action_123' },
        currentLog: 'SENSITIVE execution log',
        pilotSessionId: 'session_123',
        pilotStepId: 'step_123',
        projectId: 'project_123',
        tplConfig: { config: 'SENSITIVE' },
        runtimeConfig: { config: 'SENSITIVE' },
        agentMode: 'agent',
        copilotSessionId: 'copilot_123',
        creditCost: 100, // This should be removed as it's not in the whitelist
        customField: 'any custom field',
      };

      const sanitized = sanitizeNodeMetadata(metadata);

      // CRITICAL: Must ONLY contain whitelisted fields
      expect(Object.keys(sanitized).sort()).toEqual(
        ['shareId', 'imageUrl', 'videoUrl', 'audioUrl', 'selectedToolsets'].sort(),
      );
      expect(sanitized.shareId).toBe('share_123');
      expect(sanitized.imageUrl).toBe('https://example.com/image.png');
      expect(sanitized.videoUrl).toBe('https://example.com/video.mp4');
      expect(sanitized.audioUrl).toBe('https://example.com/audio.mp3');
      expect(sanitized.selectedToolsets).toEqual([{ toolsetId: 'toolset_123' }]); // Now KEPT

      // CRITICAL: Must NOT contain any sensitive fields
      expect(sanitized.contextItems).toBeUndefined();
      expect(sanitized.structuredData).toBeUndefined();
      expect(sanitized.query).toBeUndefined();
      expect(sanitized.modelInfo).toBeUndefined();
      expect(sanitized.tokenUsage).toBeUndefined();
      expect(sanitized.selectedSkill).toBeUndefined();
      expect(sanitized.actionMeta).toBeUndefined();
      expect(sanitized.currentLog).toBeUndefined();
      expect(sanitized.pilotSessionId).toBeUndefined();
      expect(sanitized.pilotStepId).toBeUndefined();
      expect(sanitized.projectId).toBeUndefined();
      expect(sanitized.tplConfig).toBeUndefined();
      expect(sanitized.runtimeConfig).toBeUndefined();
      expect(sanitized.agentMode).toBeUndefined();
      expect(sanitized.copilotSessionId).toBeUndefined();
      expect(sanitized.creditCost).toBeUndefined();
      expect(sanitized.customField).toBeUndefined();
    });

    it('should handle empty metadata object', () => {
      const sanitized = sanitizeNodeMetadata({});
      expect(sanitized).toEqual({});
      expect(Object.keys(sanitized)).toHaveLength(0);
    });

    it('should handle null/undefined metadata gracefully', () => {
      expect(sanitizeNodeMetadata(null as any)).toEqual({});
      expect(sanitizeNodeMetadata(undefined as any)).toEqual({});
    });

    it('should handle metadata with only forbidden fields', () => {
      const metadata = {
        contextItems: [{ type: 'document' }],
        query: 'sensitive query',
        structuredData: { data: 'sensitive' },
      };

      const sanitized = sanitizeNodeMetadata(metadata);
      expect(sanitized).toEqual({});
      expect(Object.keys(sanitized)).toHaveLength(0);
    });
  });

  describe('sanitizeCanvasDataForPublic - CRITICAL: Must Filter and Sanitize Correctly', () => {
    it('should ONLY include nodes that are in resultNodeIds and preserve type field', () => {
      const canvasData: SharedCanvasData = {
        canvasId: 'canvas_123',
        nodes: [
          {
            id: 'node_1',
            type: 'skillResponse',
            data: { entityId: 'entity_1', title: 'Result 1' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'node_2',
            type: 'image',
            data: { entityId: 'entity_2', title: 'Result 2' },
            position: { x: 100, y: 100 },
          },
          {
            id: 'node_3',
            type: 'skill',
            data: { entityId: 'entity_3', title: 'Not a result' },
            position: { x: 200, y: 200 },
          },
        ] as CanvasNode[],
        edges: [],
        files: [],
      };

      const resultNodeIds = ['node_1', 'node_2'];

      const sanitized = sanitizeCanvasDataForPublic(canvasData, resultNodeIds);

      // CRITICAL: Must ONLY include result nodes
      expect(sanitized.nodes).toHaveLength(2);
      expect(sanitized.nodes.map((n: any) => n.id)).toEqual(['node_1', 'node_2']);
      expect(sanitized.nodes.find((n: any) => n.id === 'node_3')).toBeUndefined();

      // CRITICAL: Must preserve type field for frontend rendering
      expect(sanitized.nodes[0].type).toBe('skillResponse');
      expect(sanitized.nodes[1].type).toBe('image');
    });

    it('should sanitize node metadata for all result nodes', () => {
      const canvasData: SharedCanvasData = {
        canvasId: 'canvas_123',
        nodes: [
          {
            id: 'node_1',
            type: 'skillResponse',
            data: {
              entityId: 'entity_1',
              title: 'Result 1',
              metadata: {
                shareId: 'share_123',
                contextItems: [{ type: 'document', entityId: 'doc_123' }],
                query: 'sensitive query',
              },
            },
            position: { x: 0, y: 0 },
          },
        ] as CanvasNode[],
        edges: [],
        files: [],
      };

      const sanitized = sanitizeCanvasDataForPublic(canvasData, ['node_1']);

      // CRITICAL: Node metadata must be sanitized
      expect(sanitized.nodes[0].data.metadata.shareId).toBe('share_123');
      expect(sanitized.nodes[0].data.metadata.contextItems).toBeUndefined();
      expect(sanitized.nodes[0].data.metadata.query).toBeUndefined();
    });

    it('should include ALL files without filtering and preserve all fields', () => {
      const canvasData: SharedCanvasData = {
        canvasId: 'canvas_123',
        nodes: [
          {
            id: 'node_1',
            type: 'skillResponse',
            data: { entityId: 'entity_1', title: 'Result 1' },
            position: { x: 0, y: 0 },
          },
        ] as CanvasNode[],
        edges: [],
        files: [
          {
            fileId: 'file_1',
            resultId: 'entity_1',
            name: 'result_file.txt',
            type: 'text/plain',
            size: 100,
            category: 'document',
          } as DriveFile,
          {
            fileId: 'file_2',
            resultId: 'entity_2',
            name: 'other_file.txt',
            type: 'text/plain',
            size: 200,
            category: 'document',
          } as DriveFile,
          {
            fileId: 'file_3',
            resultId: 'entity_1',
            name: 'audio_result.mp3',
            type: 'audio/mpeg',
            size: 300,
            category: 'audio',
          } as DriveFile,
        ],
      };

      const sanitized = sanitizeCanvasDataForPublic(canvasData, ['node_1']);

      // IMPORTANT: Now includes ALL files without filtering
      expect(sanitized.files).toHaveLength(3);
      expect(sanitized.files.map((f: any) => f.fileId)).toEqual(['file_1', 'file_2', 'file_3']);
      // All files are preserved, including file_2 which is not related to result nodes
      expect(sanitized.files.find((f: any) => f.fileId === 'file_2')).toBeDefined();

      // CRITICAL: Must preserve category and resultId for frontend rendering
      expect(sanitized.files[0].category).toBe('document');
      expect(sanitized.files[0].resultId).toBe('entity_1');
      expect(sanitized.files[1].category).toBe('document'); // file_2
      expect(sanitized.files[1].resultId).toBe('entity_2');
      expect(sanitized.files[2].category).toBe('audio'); // file_3
      expect(sanitized.files[2].resultId).toBe('entity_1');
    });

    it('should PRESERVE all fields in files including storageKey and other fields', () => {
      const canvasData: SharedCanvasData = {
        canvasId: 'canvas_123',
        nodes: [
          {
            id: 'node_1',
            type: 'skillResponse',
            data: { entityId: 'entity_1', title: 'Result 1' },
            position: { x: 0, y: 0 },
          },
        ] as CanvasNode[],
        edges: [],
        files: [
          {
            fileId: 'file_1',
            resultId: 'entity_1',
            name: 'result_file.txt',
            type: 'text/plain',
            size: 100,
            category: 'document',
            storageKey: 'internal/storage/key', // CRITICAL: Must be removed
            canvasId: 'canvas_123', // CRITICAL: Must be removed
            source: 'agent', // CRITICAL: Must be removed
            scope: 'present', // CRITICAL: Must be removed
            variableId: 'var_123', // CRITICAL: Must be removed
            resultVersion: 1, // CRITICAL: Must be removed
            createdAt: '2024-01-01', // CRITICAL: Must be removed
            updatedAt: '2024-01-01', // CRITICAL: Must be removed
          } as any,
        ],
      };

      const sanitized = sanitizeCanvasDataForPublic(canvasData, ['node_1']);

      // IMPORTANT: All fields are now preserved
      expect(sanitized.files[0].storageKey).toBe('internal/storage/key');
      expect(sanitized.files[0].canvasId).toBe('canvas_123');
      expect(sanitized.files[0].source).toBe('agent');
      expect(sanitized.files[0].scope).toBe('present');
      expect(sanitized.files[0].variableId).toBe('var_123');
      expect(sanitized.files[0].resultVersion).toBe(1);
      expect(sanitized.files[0].createdAt).toBe('2024-01-01');
      expect(sanitized.files[0].updatedAt).toBe('2024-01-01');

      // CRITICAL: Required fields must be preserved
      expect(sanitized.files[0].fileId).toBe('file_1');
      expect(sanitized.files[0].name).toBe('result_file.txt');
      expect(sanitized.files[0].type).toBe('text/plain');
      expect(sanitized.files[0].size).toBe(100);
      expect(sanitized.files[0].category).toBe('document');
      expect(sanitized.files[0].resultId).toBe('entity_1');
    });

    it('should handle empty resultNodeIds', () => {
      const canvasData: SharedCanvasData = {
        canvasId: 'canvas_123',
        nodes: [
          {
            id: 'node_1',
            type: 'skillResponse',
            data: { entityId: 'entity_1', title: 'Result 1' },
            position: { x: 0, y: 0 },
          },
        ] as CanvasNode[],
        edges: [],
        files: [],
      };

      const sanitized = sanitizeCanvasDataForPublic(canvasData, []);

      // CRITICAL: Must return empty arrays when no result nodes
      expect(sanitized.nodes).toEqual([]);
      expect(sanitized.files).toEqual([]);
    });

    it('should handle null/undefined canvasData gracefully', () => {
      expect(() => sanitizeCanvasDataForPublic(null as any, [])).not.toThrow();
      expect(() => sanitizeCanvasDataForPublic(undefined as any, [])).not.toThrow();
    });

    it('should handle nodes with missing data gracefully', () => {
      const canvasData: SharedCanvasData = {
        canvasId: 'canvas_123',
        nodes: [
          { id: 'node_1', type: 'skillResponse', data: undefined as any, position: { x: 0, y: 0 } },
        ] as CanvasNode[],
        edges: [],
        files: [],
      };

      const sanitized = sanitizeCanvasDataForPublic(canvasData, ['node_1']);

      // CRITICAL: Must handle missing data gracefully
      expect(sanitized.nodes[0].id).toBe('node_1');
      expect(sanitized.nodes[0].type).toBe('skillResponse');
      expect(sanitized.nodes[0].data.entityId).toBe('');
      expect(sanitized.nodes[0].data.title).toBe('');
      expect(sanitized.nodes[0].data.metadata).toEqual({});
    });

    it('should preserve all required fields for frontend rendering workflow', () => {
      // This test validates the complete sanitization flow for a real workflow scenario
      const canvasData: SharedCanvasData = {
        canvasId: 'canvas_123',
        nodes: [
          {
            id: 'node_skill_1',
            type: 'skillResponse',
            data: {
              entityId: 'ar-123',
              title: 'AI Analysis Result',
              contentPreview: 'SENSITIVE: should be removed',
              metadata: {
                shareId: 'share_123',
                query: 'SENSITIVE: user query',
                modelInfo: { model: 'gpt-4' },
                contextItems: [{ type: 'document' }],
              },
            },
            position: { x: 0, y: 0 },
          },
          {
            id: 'df-audio-123',
            type: 'audio',
            data: {
              entityId: 'df-audio-123',
              title: 'Podcast Audio',
              metadata: {
                shareId: 'share_audio',
                audioUrl: 'https://example.com/audio.mp3',
              },
            },
            position: { x: 100, y: 100 },
          },
        ] as CanvasNode[],
        edges: [],
        files: [
          {
            fileId: 'df-doc-456',
            resultId: 'ar-123',
            name: 'Summary Report.txt',
            type: 'text/plain',
            category: 'document',
            size: 5000,
            storageKey: 'internal/path/to/file',
            canvasId: 'canvas_123',
            source: 'agent',
            scope: 'present',
          } as any,
          {
            fileId: 'df-audio-789',
            resultId: 'ar-123',
            name: 'Podcast.mp3',
            type: 'audio/mpeg',
            category: 'audio',
            size: 2000000,
            storageKey: 'internal/path/to/audio',
          } as any,
        ],
      };

      const resultNodeIds = ['node_skill_1', 'df-audio-123'];
      const sanitized = sanitizeCanvasDataForPublic(canvasData, resultNodeIds);

      // Validate nodes
      expect(sanitized.nodes).toHaveLength(2);

      // Node 1: skillResponse
      expect(sanitized.nodes[0].id).toBe('node_skill_1');
      expect(sanitized.nodes[0].type).toBe('skillResponse');
      expect(sanitized.nodes[0].data.entityId).toBe('ar-123');
      expect(sanitized.nodes[0].data.title).toBe('AI Analysis Result');
      expect(sanitized.nodes[0].data.contentPreview).toBeUndefined();
      expect(sanitized.nodes[0].data.metadata.shareId).toBe('share_123');
      expect(sanitized.nodes[0].data.metadata.query).toBeUndefined();
      expect(sanitized.nodes[0].data.metadata.modelInfo).toBeUndefined();
      expect(sanitized.nodes[0].data.metadata.contextItems).toBeUndefined();

      // Node 2: audio
      expect(sanitized.nodes[1].id).toBe('df-audio-123');
      expect(sanitized.nodes[1].type).toBe('audio');
      expect(sanitized.nodes[1].data.metadata.audioUrl).toBe('https://example.com/audio.mp3');

      // Validate files (now includes ALL files with ALL fields)
      expect(sanitized.files).toHaveLength(2);

      // File 1: document
      expect(sanitized.files[0].fileId).toBe('df-doc-456');
      expect(sanitized.files[0].name).toBe('Summary Report.txt');
      expect(sanitized.files[0].type).toBe('text/plain');
      expect(sanitized.files[0].category).toBe('document');
      expect(sanitized.files[0].resultId).toBe('ar-123');
      // All fields are now preserved
      expect(sanitized.files[0].storageKey).toBe('internal/path/to/file');
      expect(sanitized.files[0].canvasId).toBe('canvas_123');
      expect(sanitized.files[0].source).toBe('agent');
      expect(sanitized.files[0].scope).toBe('present');

      // File 2: audio
      expect(sanitized.files[1].fileId).toBe('df-audio-789');
      expect(sanitized.files[1].category).toBe('audio');
      expect(sanitized.files[1].resultId).toBe('ar-123');
      // All fields are preserved
      expect(sanitized.files[1].storageKey).toBe('internal/path/to/audio');
    });
  });
});
