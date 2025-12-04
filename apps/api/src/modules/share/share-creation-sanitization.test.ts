import { Test, TestingModule } from '@nestjs/testing';
import { ShareCreationService } from './share-creation.service';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { CanvasService } from '../canvas/canvas.service';
import { DocumentService } from '../knowledge/document.service';
import { ResourceService } from '../knowledge/resource.service';
import { ActionService } from '../action/action.service';
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { CreditService } from '../credit/credit.service';
import { ShareCommonService } from './share-common.service';
import { ShareRateLimitService } from './share-rate-limit.service';
import { ConfigService } from '@nestjs/config';
import { DriveService } from '../drive/drive.service';
import { SharedCanvasData } from '@refly/openapi-schema';

describe('ShareCreationService - Data Sanitization', () => {
  let service: ShareCreationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareCreationService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: MiscService,
          useValue: {},
        },
        {
          provide: CanvasService,
          useValue: {},
        },
        {
          provide: DocumentService,
          useValue: {},
        },
        {
          provide: ResourceService,
          useValue: {},
        },
        {
          provide: ActionService,
          useValue: {},
        },
        {
          provide: CodeArtifactService,
          useValue: {},
        },
        {
          provide: CreditService,
          useValue: {},
        },
        {
          provide: ShareCommonService,
          useValue: {},
        },
        {
          provide: ShareRateLimitService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: DriveService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ShareCreationService>(ShareCreationService);
  });

  describe('sanitizeCanvasDataForPublic', () => {
    it('should filter nodes to only result nodes', () => {
      const canvasData: SharedCanvasData = {
        canvasId: 'test-canvas',
        title: 'Test Canvas',
        nodes: [
          {
            id: 'result-node-1',
            type: 'skillResponse',
            position: { x: 100, y: 200 },
            data: {
              entityId: 'entity-1',
              title: 'Result 1',
              contentPreview: 'Preview 1',
              metadata: {
                shareId: 'share-1',
                imageUrl: 'https://example.com/image1.jpg',
                sensitiveField: 'SENSITIVE_DATA',
                contextItems: [
                  {
                    type: 'document',
                    entityId: 'doc_xxx',
                    metadata: {
                      contentPreview: 'Confidential business data...',
                      selectedContent: 'Sensitive information...',
                    },
                  },
                ],
                query: 'Analyze our Q4 financial data',
              },
            },
          },
          {
            id: 'non-result-node',
            type: 'document',
            position: { x: 300, y: 400 },
            data: {
              entityId: 'entity-2',
              title: 'Non-Result Node',
              metadata: {
                sensitiveField: 'MORE_SENSITIVE_DATA',
              },
            },
          },
        ],
        files: [
          {
            fileId: 'file-1',
            canvasId: 'test-canvas',
            name: 'result-file.pdf',
            type: 'pdf',
            category: 'document',
            size: 1024,
            source: 'agent',
            scope: 'present',
            resultId: 'entity-1',
            resultVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            storageKey: 'INTERNAL_STORAGE_KEY',
          },
          {
            fileId: 'file-2',
            canvasId: 'test-canvas',
            name: 'non-result-file.pdf',
            type: 'pdf',
            category: 'document',
            size: 2048,
            source: 'agent',
            scope: 'present',
            resultId: 'entity-2',
            resultVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            storageKey: 'INTERNAL_STORAGE_KEY_2',
          },
        ],
        edges: [],
        resources: [],
      };

      const resultNodeIds = ['result-node-1'];

      // Access the private method using bracket notation
      const result = (service as any).sanitizeCanvasDataForPublic(canvasData, resultNodeIds);

      // Should only include the result node
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('result-node-1');

      // Should sanitize metadata - keep shareId and media URLs for result display
      expect(result.nodes[0].data.metadata).toEqual({
        shareId: 'share-1',
        imageUrl: 'https://example.com/image1.jpg',
      });

      // Should NOT include workflow design information
      expect(result.nodes[0].position).toBeUndefined();
      expect(result.nodes[0].type).toBeUndefined(); // Node type could reveal skill types

      // Should NOT include content preview that could reveal processing methods
      expect(result.nodes[0].data.contentPreview).toBeUndefined();

      // Should NOT include sensitive workflow fields
      expect(result.nodes[0].data.metadata.sensitiveField).toBeUndefined();
      expect(result.nodes[0].data.metadata.contextItems).toBeUndefined();
      expect(result.nodes[0].data.metadata.query).toBeUndefined();
      expect(result.nodes[0].data.metadata.creditCost).toBeUndefined();

      // Should include only result-related files with minimal info
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toEqual({
        fileId: 'file-1',
        name: 'result-file.pdf',
        type: 'pdf',
        size: 1024,
      });

      // Should NOT include internal workflow-related file fields
      expect(result.files[0].storageKey).toBeUndefined();
      expect(result.files[0].canvasId).toBeUndefined();
      expect(result.files[0].category).toBeUndefined();
      expect(result.files[0].source).toBeUndefined();
      expect(result.files[0].scope).toBeUndefined();
      expect(result.files[0].resultId).toBeUndefined();
      expect(result.files[0].resultVersion).toBeUndefined();
      expect(result.files[0].createdAt).toBeUndefined();
      expect(result.files[0].updatedAt).toBeUndefined();
    });

    it('should handle empty or missing data gracefully', () => {
      const canvasData: SharedCanvasData = {
        canvasId: 'test-canvas',
        title: 'Empty Canvas',
        nodes: null,
        files: null,
        edges: [],
        resources: [],
      };

      const resultNodeIds: string[] = [];

      const result = (service as any).sanitizeCanvasDataForPublic(canvasData, resultNodeIds);

      expect(result.nodes).toEqual([]);
      expect(result.files).toEqual([]);
    });
  });

  describe('sanitizeNodeMetadata', () => {
    it('should only keep whitelisted fields', () => {
      const metadata = {
        shareId: 'share-123',
        imageUrl: 'https://example.com/image.jpg',
        videoUrl: 'https://example.com/video.mp4',
        audioUrl: 'https://example.com/audio.mp3',
        creditCost: 10,
        // Sensitive fields that should be removed
        contextItems: ['sensitive', 'data'],
        structuredData: { secret: 'data' },
        query: 'sensitive query',
        modelInfo: { model: 'gpt-4' },
        tokenUsage: 1000,
        selectedSkill: 'skill-1',
        selectedToolsets: ['tool-1'],
        actionMeta: { action: 'data' },
        currentLog: 'execution log',
        pilotSessionId: 'session-123',
        pilotStepId: 'step-123',
        projectId: 'project-123',
        tplConfig: { template: 'config' },
        runtimeConfig: { runtime: 'config' },
        agentMode: 'auto',
        copilotSessionId: 'copilot-123',
      };

      const result = (service as any).sanitizeNodeMetadata(metadata);

      expect(result).toEqual({
        shareId: 'share-123',
        imageUrl: 'https://example.com/image.jpg',
        videoUrl: 'https://example.com/video.mp4',
        audioUrl: 'https://example.com/audio.mp3',
      });

      // Verify sensitive workflow fields are removed
      expect(result.contextItems).toBeUndefined();
      expect(result.structuredData).toBeUndefined();
      expect(result.query).toBeUndefined();
      expect(result.modelInfo).toBeUndefined();
      expect(result.pilotSessionId).toBeUndefined();
      expect(result.creditCost).toBeUndefined(); // Cost removed to avoid revealing model complexity
    });

    it('should handle empty metadata', () => {
      const result = (service as any).sanitizeNodeMetadata({});
      expect(result).toEqual({});
    });

    it('should handle null/undefined metadata', () => {
      const result = (service as any).sanitizeNodeMetadata(null);
      expect(result).toEqual({});
    });
  });

  describe('sanitizeVariables', () => {
    it('should keep user variables intact - no masking needed', () => {
      const variables = [
        {
          variableId: 'var-1',
          variableType: 'string',
          name: 'email',
          value: [{ type: 'text', text: 'user@example.com' }],
          description: 'Email address',
        },
      ];

      const result = (service as any).sanitizeVariables(variables);

      expect(result[0].value[0].text).toBe('user@example.com');
      expect(result[0].name).toBe('email');
      expect(result[0].variableType).toBe('string');
    });

    it('should preserve all variable data as-is', () => {
      const variables = [
        {
          variableId: 'var-2',
          variableType: 'string',
          name: 'phone',
          value: [{ type: 'text', text: '+1234567890' }],
          description: 'Phone number',
        },
      ];

      const result = (service as any).sanitizeVariables(variables);

      expect(result[0].value[0].text).toBe('+1234567890');
      expect(result[0].description).toBe('Phone number');
    });

    it('should handle empty variables array', () => {
      const result = (service as any).sanitizeVariables([]);
      expect(result).toEqual([]);
    });

    it('should handle null/undefined variables', () => {
      const result = (service as any).sanitizeVariables(null);
      expect(result).toEqual([]);
    });
  });

  describe('sanitizeTemplateContent', () => {
    it('should truncate long template content naturally', () => {
      const longContent = `${'这是一个很长的模板内容。'.repeat(50)}这是最后一句话。`;

      const result = (service as any).sanitizeTemplateContent(longContent);

      expect(result.length).toBeLessThanOrEqual(300);
      expect(result.endsWith('。')).toBe(true); // Should end at sentence boundary
    });

    it('should handle short content unchanged', () => {
      const shortContent = '这是一个短的模板内容。';

      const result = (service as any).sanitizeTemplateContent(shortContent);

      expect(result).toBe(shortContent);
    });
  });

  describe('sanitizeTimestamp', () => {
    it('should reduce timestamp precision to hours', () => {
      const timestamp = '2025-12-03T12:34:56.789Z';

      const result = (service as any).sanitizeTimestamp(timestamp);

      expect(result).toBe('2025-12-03T12:00:00.000Z');
    });

    it('should handle invalid timestamps', () => {
      const result = (service as any).sanitizeTimestamp('invalid-date');

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
