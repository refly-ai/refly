import { Test, TestingModule } from '@nestjs/testing';
import { AutoModelRoutingService } from './auto-model-router.service';
import { createMock } from '@golevelup/ts-jest';
import { PrismaService } from '../common/prisma.service';
import { ProviderItem as ProviderItemModel } from '@prisma/client';

describe('AutoModelRoutingService', () => {
  let service: AutoModelRoutingService;
  let prismaService: PrismaService;

  // Mock provider items for testing
  const mockClaudeSonnetItem: ProviderItemModel = {
    pk: 1,
    itemId: 'item-claude-sonnet',
    uid: 'test-user',
    category: 'llm',
    providerId: 'anthropic',
    name: 'Claude Sonnet',
    enabled: true,
    config: JSON.stringify({
      modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      capabilities: {},
    }),
    tier: 'premium',
    creditBilling: null,
    order: 0,
    groupName: '',
    globalItemId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockGeminiFlashItem: ProviderItemModel = {
    pk: 2,
    itemId: 'item-gemini-flash',
    uid: 'test-user',
    category: 'llm',
    providerId: 'google',
    name: 'Gemini Flash',
    enabled: true,
    config: JSON.stringify({
      modelId: 'gemini-3-flash-preview',
      capabilities: {},
    }),
    tier: 'premium',
    creditBilling: null,
    order: 0,
    groupName: '',
    globalItemId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockAutoModelItem: ProviderItemModel = {
    pk: 3,
    itemId: 'item-auto',
    uid: 'test-user',
    category: 'llm',
    providerId: 'auto',
    name: 'Auto Model',
    enabled: true,
    config: JSON.stringify({
      modelId: 'auto',
      isAuto: true,
    }),
    tier: 'premium',
    creditBilling: null,
    order: 0,
    groupName: '',
    globalItemId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoModelRoutingService,
        { provide: PrismaService, useValue: createMock<PrismaService>() },
      ],
    }).compile();

    service = module.get<AutoModelRoutingService>(AutoModelRoutingService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Mock autoModelRoutingRule.findMany to return empty array
    prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([]);

    // Mock autoModelRoutingResult.create to prevent database writes
    prismaService.autoModelRoutingResult.create = jest.fn().mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Fixed Routing (Priority 1)', () => {
    it('TC1.1: should route to specified model when model field is set', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-1',
        ruleName: 'Fixed Routing Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({ model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0' }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert
      expect(result.itemId).toBe('item-claude-sonnet');
    });

    it('TC1.2: should return fallback when model does not exist', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-2',
        ruleName: 'Non-existent Model Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({ model: 'non-existent-model' }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should fall back to first available model
      expect(result.itemId).toBe('item-claude-sonnet');
    });
  });

  describe('Random Routing (Priority 2)', () => {
    it('TC2.1: should randomly select from models array', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-3',
        ruleName: 'Random Routing Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          models: ['global.anthropic.claude-sonnet-4-5-20250929-v1:0', 'gemini-3-flash-preview'],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - result should be one of the models
      expect(['item-claude-sonnet', 'item-gemini-flash']).toContain(result.itemId);
    });

    it('TC2.2: should return fallback when all models in array do not exist', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-4',
        ruleName: 'Non-existent Models Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          models: ['non-existent-1', 'non-existent-2'],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should fall back to first available model
      expect(result.itemId).toBe('item-claude-sonnet');
    });

    it('TC2.3: should only select from available models', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-5',
        ruleName: 'Partial Available Models Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          models: ['global.anthropic.claude-sonnet-4-5-20250929-v1:0', 'non-existent'],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should only select from available models (claude-sonnet)
      expect(result.itemId).toBe('item-claude-sonnet');
    });

    it('TC2.4: should be able to select different models in multiple calls (randomness check)', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-6',
        ruleName: 'Randomness Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          models: ['global.anthropic.claude-sonnet-4-5-20250929-v1:0', 'gemini-3-flash-preview'],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act - run multiple times
      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const result = await service.route(mockAutoModelItem, context);
        results.add(result.itemId);
      }

      // Assert - should have selected different models (with high probability)
      // Note: There's a small chance this test could fail due to randomness
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('Weighted Routing (Priority 3)', () => {
    it('TC3.1: should select based on weight proportions', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-7',
        ruleName: 'Weighted Routing Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          weights: [
            { model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', weight: 80 },
            { model: 'gemini-3-flash-preview', weight: 20 },
          ],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - result should be one of the weighted models
      expect(['item-claude-sonnet', 'item-gemini-flash']).toContain(result.itemId);
    });

    it('TC3.2: should ignore models with weight 0', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-8',
        ruleName: 'Zero Weight Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          weights: [
            { model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', weight: 100 },
            { model: 'gemini-3-flash-preview', weight: 0 },
          ],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should only select claude-sonnet (weight 100)
      expect(result.itemId).toBe('item-claude-sonnet');
    });

    it('TC3.3: should return fallback when all weights are 0', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-9',
        ruleName: 'All Zero Weights Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          weights: [
            { model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', weight: 0 },
            { model: 'gemini-3-flash-preview', weight: 0 },
          ],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should fall back to first available model
      expect(result.itemId).toBe('item-claude-sonnet');
    });

    it('TC3.4: should ignore non-existent models', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-10',
        ruleName: 'Non-existent Model in Weights Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          weights: [
            { model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', weight: 50 },
            { model: 'non-existent-model', weight: 50 },
          ],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should only select claude-sonnet (only available model)
      expect(result.itemId).toBe('item-claude-sonnet');
    });

    it('TC3.5: should follow weight distribution in multiple calls', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-11',
        ruleName: 'Weight Distribution Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          weights: [
            { model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', weight: 80 },
            { model: 'gemini-3-flash-preview', weight: 20 },
          ],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act - run multiple times to verify distribution
      const counts = {
        'item-claude-sonnet': 0,
        'item-gemini-flash': 0,
      };

      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        const result = await service.route(mockAutoModelItem, context);
        counts[result.itemId]++;
      }

      // Assert - verify approximate distribution (80/20)
      // Allow some tolerance for randomness (70-90% for claude, 10-30% for gemini)
      const claudePercentage = (counts['item-claude-sonnet'] / iterations) * 100;
      const geminiPercentage = (counts['item-gemini-flash'] / iterations) * 100;

      expect(claudePercentage).toBeGreaterThanOrEqual(70);
      expect(claudePercentage).toBeLessThanOrEqual(90);
      expect(geminiPercentage).toBeGreaterThanOrEqual(10);
      expect(geminiPercentage).toBeLessThanOrEqual(30);
    });
  });

  describe('Priority Order Tests', () => {
    it('TC4.1: should prioritize model field over models field', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-12',
        ruleName: 'Model Priority Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
          models: ['gemini-3-flash-preview'],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should use model field (claude-sonnet)
      expect(result.itemId).toBe('item-claude-sonnet');
    });

    it('TC4.2: should use models field when model is empty string', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-13',
        ruleName: 'Empty Model String Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          model: '',
          models: ['gemini-3-flash-preview'],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should use models field (gemini-flash)
      expect(result.itemId).toBe('item-gemini-flash');
    });

    it('TC4.3: should use weights field when model and models are empty', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-14',
        ruleName: 'Weights Priority Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({
          model: null,
          models: [],
          weights: [{ model: 'gemini-3-flash-preview', weight: 100 }],
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should use weights field (gemini-flash)
      expect(result.itemId).toBe('item-gemini-flash');
    });
  });

  describe('Backward Compatibility Tests', () => {
    it('TC5.1: should work with existing {"model": "xxx"} format', async () => {
      // Arrange
      const rule = {
        ruleId: 'test-rule-15',
        ruleName: 'Legacy Format Test',
        scene: 'agent',
        priority: 100,
        enabled: true,
        condition: '{}',
        target: JSON.stringify({ model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0' }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue([rule]);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert
      expect(result.itemId).toBe('item-claude-sonnet');
    });

    it('TC5.2: should not affect existing rules without new fields', async () => {
      // Arrange
      const rules = [
        {
          ruleId: 'legacy-rule-1',
          ruleName: 'Legacy Rule 1',
          scene: 'agent',
          priority: 100,
          enabled: true,
          condition: '{}',
          target: JSON.stringify({ model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0' }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          ruleId: 'legacy-rule-2',
          ruleName: 'Legacy Rule 2',
          scene: 'agent',
          priority: 90,
          enabled: true,
          condition: '{}',
          target: JSON.stringify({ model: 'gemini-3-flash-preview' }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prismaService.autoModelRoutingRule.findMany = jest.fn().mockResolvedValue(rules);

      const context = {
        llmItems: [mockClaudeSonnetItem, mockGeminiFlashItem],
        userId: 'test-user',
        mode: 'node_agent',
      };

      // Act
      const result = await service.route(mockAutoModelItem, context);

      // Assert - should use first matching rule (priority 100)
      expect(result.itemId).toBe('item-claude-sonnet');
    });
  });
});
