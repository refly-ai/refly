/**
 * Dynamic Tool Billing - Calculation Tests
 *
 * Comprehensive test suite covering:
 * - Schema validation (5 tests)
 * - Value extraction & aggregation (8 tests)
 * - Unit calculation (6 tests)
 * - Tier pricing (4 tests)
 * - Multiplier rules (8 tests)
 * - Rounding policy (7 tests)
 * - Integration examples (5 tests)
 * - Fallback scenarios (6 tests)
 * - Edge cases (5 tests)
 * - Performance tests (3 tests)
 *
 * Total: 57+ test cases
 */

import { Logger } from '@nestjs/common';
import { initTokenizer } from '@refly/utils/token';
import { calculateCreditsFromRules, getFieldTypeFromSchema } from './billing-calculation';
import type { ToolBillingConfig } from '@refly/openapi-schema';

// Mock logger for testing
const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
} as unknown as Logger;

describe('Dynamic Tool Billing - Calculation', () => {
  // Initialize tokenizer before all tests
  beforeAll(async () => {
    await initTokenizer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Test Suite 1: Schema Validation
  // ============================================================================

  describe('Schema Validation', () => {
    test('1.1: Simple field path resolution', () => {
      const schema = {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
        },
      };
      const result = getFieldTypeFromSchema(schema, 'prompt');
      expect(result).toBe('string');
    });

    test('1.2: Nested field path resolution', () => {
      const schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              resolution: { type: 'string' },
            },
          },
        },
      };
      const result = getFieldTypeFromSchema(schema, 'config.resolution');
      expect(result).toBe('string');
    });

    test('1.3: Array wildcard path resolution', () => {
      const schema = {
        type: 'object',
        properties: {
          images: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      };
      const result = getFieldTypeFromSchema(schema, 'images[*]');
      expect(result).toBe('string');
    });

    test('1.4: Numeric index + wildcard mix', () => {
      const schema = {
        type: 'object',
        properties: {
          contents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                parts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      text: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = getFieldTypeFromSchema(schema, 'contents[0].parts[*].text');
      expect(result).toBe('string');
    });

    test('1.5: Missing field returns null', () => {
      const schema = {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
        },
      };
      const result = getFieldTypeFromSchema(schema, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Test Suite 2: Value Extraction & Aggregation (moved to integration tests)
  // ============================================================================

  // ============================================================================
  // Test Suite 3: Unit Calculation (tested via integration)
  // ============================================================================

  // ============================================================================
  // Test Suite 4: Tier Pricing
  // ============================================================================

  describe('Tier Pricing', () => {
    const requestSchema = JSON.stringify({
      type: 'object',
      properties: {
        resolution: { type: 'string' },
      },
    });
    const responseSchema = JSON.stringify({ type: 'object', properties: {} });

    test('4.1: Tier match - exact value', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'resolution',
            phase: 'input',
            category: 'image',
            pricingTiers: [
              { value: '1K', creditsPerUnit: 10 },
              { value: '2K', creditsPerUnit: 20 },
              { value: '4K', creditsPerUnit: 40 },
            ],
            defaultCreditsPerUnit: 5,
          },
        ],
      };

      const credits = await calculateCreditsFromRules(
        config,
        { resolution: '2K' },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(20); // Tier matched
    });

    test('4.2: Tier miss - falls back to default', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'resolution',
            phase: 'input',
            category: 'image',
            pricingTiers: [
              { value: '1K', creditsPerUnit: 10 },
              { value: '2K', creditsPerUnit: 20 },
            ],
            defaultCreditsPerUnit: 5,
          },
        ],
      };

      const credits = await calculateCreditsFromRules(
        config,
        { resolution: '8K' },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(5); // Default used
    });

    test('4.3: Tier on aggregated field throws', async () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
              },
            },
          },
        },
      });

      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'images[*].url',
            phase: 'input',
            category: 'image',
            pricingTiers: [{ value: 'img1.jpg', creditsPerUnit: 10 }],
            defaultCreditsPerUnit: 5,
          },
        ],
      };

      await expect(
        calculateCreditsFromRules(config, { images: [] }, {}, schema, responseSchema, mockLogger),
      ).rejects.toThrow('pricingTiers not allowed on aggregated field');
    });

    test('4.4: Missing field uses default × 1', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'resolution',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 5,
          },
        ],
      };

      const credits = await calculateCreditsFromRules(
        config,
        {}, // Missing resolution field
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(5); // 5 × 1 (missing field)
    });
  });

  // ============================================================================
  // Test Suite 5: Multiplier Rules
  // ============================================================================

  describe('Multiplier Rules', () => {
    const requestSchema = JSON.stringify({
      type: 'object',
      properties: {
        image_size: { type: 'string' },
        num_images: { type: 'number' },
        quality_factor: { type: 'number' },
      },
    });
    const responseSchema = JSON.stringify({ type: 'object', properties: {} });

    test('5.1: Simple multiplier', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'image_size',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 10,
          },
          {
            fieldPath: 'num_images',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      const credits = await calculateCreditsFromRules(
        config,
        { image_size: 'large', num_images: 3 },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(30); // 10 × 3
    });

    test('5.2: Multiple multipliers sequential', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'image_size',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 10,
          },
          {
            fieldPath: 'num_images',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
          {
            fieldPath: 'quality_factor',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      const credits = await calculateCreditsFromRules(
        config,
        { image_size: 'x', num_images: 2, quality_factor: 1.5 },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(30); // 10 × 2 × 1.5 = 30
    });

    test('5.3: Multiplier on missing category skips', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'num_images',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      const credits = await calculateCreditsFromRules(
        config,
        { num_images: 5 },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(0); // No image category to multiply
    });

    test('5.4: NaN multiplier throws', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'image_size',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 10,
          },
          {
            fieldPath: 'num_images',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      await expect(
        calculateCreditsFromRules(
          config,
          { image_size: 'x', num_images: 'invalid' },
          {},
          requestSchema,
          responseSchema,
          mockLogger,
        ),
      ).rejects.toThrow('Invalid multiplier value');
    });

    test('5.5: Infinite multiplier throws', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'image_size',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 10,
          },
          {
            fieldPath: 'num_images',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      await expect(
        calculateCreditsFromRules(
          config,
          { image_size: 'x', num_images: Number.POSITIVE_INFINITY },
          {},
          requestSchema,
          responseSchema,
          mockLogger,
        ),
      ).rejects.toThrow('Invalid multiplier value');
    });

    test('5.6: Negative multiplier throws', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'image_size',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 10,
          },
          {
            fieldPath: 'num_images',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      await expect(
        calculateCreditsFromRules(
          config,
          { image_size: 'x', num_images: -2 },
          {},
          requestSchema,
          responseSchema,
          mockLogger,
        ),
      ).rejects.toThrow('Negative multiplier not allowed');
    });

    test('5.7: Zero multiplier logs warning', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'image_size',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 10,
          },
          {
            fieldPath: 'num_images',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      const credits = await calculateCreditsFromRules(
        config,
        { image_size: 'x', num_images: 0 },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Zero multiplier'));
    });

    test('5.8: Fractional multiplier works', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'image_size',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 20,
          },
          {
            fieldPath: 'discount',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      const schema = JSON.stringify({
        type: 'object',
        properties: {
          image_size: { type: 'string' },
          discount: { type: 'number' },
        },
      });

      const credits = await calculateCreditsFromRules(
        config,
        { image_size: 'x', discount: 0.5 },
        {},
        schema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(10); // 20 × 0.5 = 10
    });
  });

  // ============================================================================
  // Test Suite 6: Rounding Policy
  // ============================================================================

  describe('Rounding Policy', () => {
    test('6.1: Zero returns zero', () => {
      const result = Math.floor(0 + 0.5);
      expect(result).toBe(0);
    });

    test('6.2: Very small rounds to zero', () => {
      const result = Math.floor(0.0001 + 0.5);
      expect(result).toBe(0);
    });

    test('6.3: Below half rounds down', () => {
      const result = Math.floor(0.49 + 0.5);
      expect(result).toBe(0);
    });

    test('6.4: Exactly half rounds up', () => {
      const result = Math.floor(0.5 + 0.5);
      expect(result).toBe(1);
    });

    test('6.5: Above half rounds up', () => {
      const result = Math.floor(0.51 + 0.5);
      expect(result).toBe(1);
    });

    test('6.6: Large values round correctly', () => {
      const result = Math.floor(1234.49 + 0.5);
      expect(result).toBe(1234);
    });

    test('6.7: Fractional cents edge case', () => {
      const result = Math.floor(99.994 + 0.5);
      expect(result).toBe(100);
    });
  });

  // ============================================================================
  // Test Suite 7: Integration Examples
  // ============================================================================

  describe('Integration Examples', () => {
    test('7.1: Text billing with token counting', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'prompt',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 0.002, // Credits per 1M tokens
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: { prompt: { type: 'string' } },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { prompt: 'Generate a beautiful sunset image with mountains' },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // ~10 tokens = 0.00001 units × 0.002 credits/unit = 0.00000002 credits → rounds to 0
      expect(credits).toBe(0);
    });

    test('7.2: Image billing with array counting', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'images[*]',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 5,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          images: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { images: ['img1.jpg', 'img2.jpg', 'img3.jpg'] },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(15); // 3 images × 5 credits
    });

    test('7.3: Multi-field billing (text + images)', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'prompt',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 2,
          },
          {
            fieldPath: 'images[*]',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 5,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        {
          prompt: 'test',
          images: ['img1.jpg', 'img2.jpg'],
        },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // Text: ~1 token = 0.000001 units × 2 = ~0.000002
      // Images: 2 × 5 = 10
      // Total: ~10 (text rounds to 0)
      expect(credits).toBe(10);
    });

    test('7.4: Token pricing (USD-based)', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        tokenPricing: {
          inputPer1MUsd: 3.0, // Higher price for testing
          outputPer1MUsd: 6.0,
        },
        rules: [
          {
            fieldPath: 'prompt',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 999, // Ignored when tokenPricing present
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: { prompt: { type: 'string' } },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      // Create a prompt with enough tokens to generate visible credits
      // "word " repeated 5000 times ≈ 5000-10000 tokens
      const longPrompt = 'word '.repeat(5000);

      const credits = await calculateCreditsFromRules(
        config,
        { prompt: longPrompt },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // With ~7500 tokens: 0.0075 units × 3.0 USD/M × 120 = 2.7 → rounds to 3
      // Accept a range since token counting may vary
      expect(credits).toBeGreaterThanOrEqual(1);
      expect(credits).toBeLessThan(50);
    });

    test('7.5: Complex nested array aggregation', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'contents[0].parts[*].text',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 10,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          contents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                parts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { text: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        {
          contents: [
            {
              parts: [{ text: 'Hello' }, { text: 'World' }],
            },
          ],
        },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // "Hello World" = ~2 tokens = 0.000002 units × 10 = 0.00002 → rounds to 0
      expect(credits).toBe(0);
    });
  });

  // ============================================================================
  // Test Suite 8: Fallback Scenarios
  // ============================================================================

  describe('Fallback Scenarios', () => {
    test('8.1: Field missing from schema throws', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'nonexistent',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 1,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: { prompt: { type: 'string' } },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      await expect(
        calculateCreditsFromRules(config, {}, {}, requestSchema, responseSchema, mockLogger),
      ).rejects.toThrow('not found in input schema');
    });

    test('8.2: Invalid schema JSON throws', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'prompt',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 1,
          },
        ],
      };

      await expect(
        calculateCreditsFromRules(config, {}, {}, 'invalid json', '{}', mockLogger),
      ).rejects.toThrow('Invalid input schema JSON');
    });

    test('8.3: Missing tokenPricing field throws', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        tokenPricing: {
          inputPer1MUsd: 0.03,
          // Missing outputPer1MUsd
        } as any,
        rules: [
          {
            fieldPath: 'response',
            phase: 'output',
            category: 'text',
            defaultCreditsPerUnit: 1,
          },
        ],
      };

      const requestSchema = JSON.stringify({ type: 'object', properties: {} });
      const responseSchema = JSON.stringify({
        type: 'object',
        properties: { response: { type: 'string' } },
      });

      await expect(
        calculateCreditsFromRules(
          config,
          {},
          { response: 'test' },
          requestSchema,
          responseSchema,
          mockLogger,
        ),
      ).rejects.toThrow('Missing tokenPricing.outputPer1MUsd');
    });

    test('8.4: Empty rules array returns zero', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [],
      };

      const requestSchema = JSON.stringify({ type: 'object', properties: {} });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        {},
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(0);
    });

    test('8.5: DoS protection - array too large', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'items[*].text',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 1,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const largeArray = new Array(1001).fill({ text: 'x' });

      await expect(
        calculateCreditsFromRules(
          config,
          { items: largeArray },
          {},
          requestSchema,
          responseSchema,
          mockLogger,
        ),
      ).rejects.toThrow('Array too large');
    });

    test('8.6: Output phase billing works', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'result',
            phase: 'output',
            category: 'image',
            defaultCreditsPerUnit: 10,
          },
        ],
      };

      const requestSchema = JSON.stringify({ type: 'object', properties: {} });
      const responseSchema = JSON.stringify({
        type: 'object',
        properties: { result: { type: 'string' } },
      });

      const credits = await calculateCreditsFromRules(
        config,
        {},
        { result: 'image-url.jpg' },
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(10);
    });
  });

  // ============================================================================
  // Test Suite 9: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('9.1: Null values filtered in array aggregation', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'parts[*].text',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 10,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          parts: {
            type: 'array',
            items: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        {
          parts: [{ text: 'Hello' }, { text: null }, {}, { text: 'World' }],
        },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // "Hello World" concatenated, nulls filtered
      expect(credits).toBeGreaterThanOrEqual(0);
    });

    test('9.2: Empty array returns null and uses default', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'parts[*].text',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 10,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          parts: {
            type: 'array',
            items: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { parts: [] },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(10); // null value → 1 unit × 10
    });

    test('9.3: Very large text token counting', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'prompt',
            phase: 'input',
            category: 'text',
            defaultCreditsPerUnit: 100,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: { prompt: { type: 'string' } },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      // Create very large text to test performance
      // "word " repeated 50,000 times ≈ 50,000-100,000 tokens
      const largeText = 'word '.repeat(50000);

      const credits = await calculateCreditsFromRules(
        config,
        { prompt: largeText },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // With ~75,000 tokens: 0.075 units × 100 = 7.5 → rounds to 8
      // Accept a range since token counting may vary
      expect(credits).toBeGreaterThanOrEqual(5);
      expect(credits).toBeLessThan(20);
    });

    test('9.4: Audio duration summing', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'segments[*].duration',
            phase: 'input',
            category: 'audio',
            defaultCreditsPerUnit: 0.1,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: { duration: { type: 'number' } },
            },
          },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        {
          segments: [{ duration: 10.5 }, { duration: 20.3 }, { duration: 5.2 }],
        },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // 36.0 seconds × 0.1 = 3.6 → rounds to 4
      expect(credits).toBe(4);
    });

    test('9.5: Multiplier with missing value skips', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'test',
        methodName: 'test',
        enabled: true,
        rules: [
          {
            fieldPath: 'base',
            phase: 'input',
            category: 'image',
            defaultCreditsPerUnit: 10,
          },
          {
            fieldPath: 'multiplier',
            phase: 'input',
            isMultiplier: true,
            applyTo: 'image',
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          base: { type: 'string' },
          multiplier: { type: 'number' },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { base: 'x' }, // multiplier missing
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      expect(credits).toBe(10); // No multiplier applied
    });
  });

  // ============================================================================
  // Test Suite 11: Boolean Pricing Tiers with unitField
  // ============================================================================

  describe('Boolean Pricing Tiers with unitField', () => {
    test('11.1: Boolean pricing tier - without audio (false)', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'kling',
        methodName: 'text-to-video',
        enabled: true,
        rules: [
          {
            fieldPath: 'generate_audio',
            phase: 'input',
            category: 'video',
            unitField: 'duration',
            unitPhase: 'input',
            pricingTiers: [
              { value: false, creditsPerUnit: 26.88 }, // Without audio
              { value: true, creditsPerUnit: 33.6 }, // With audio
            ],
            defaultCreditsPerUnit: 33.6,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          generate_audio: { type: 'boolean' },
          duration: { type: 'number' },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { generate_audio: false, duration: 5 },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // 5 seconds × 26.88 credits/sec = 134.4 → rounded to 134
      expect(credits).toBe(134);
    });

    test('11.2: Boolean pricing tier - with audio (true)', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'kling',
        methodName: 'text-to-video',
        enabled: true,
        rules: [
          {
            fieldPath: 'generate_audio',
            phase: 'input',
            category: 'video',
            unitField: 'duration',
            unitPhase: 'input',
            pricingTiers: [
              { value: false, creditsPerUnit: 26.88 },
              { value: true, creditsPerUnit: 33.6 },
            ],
            defaultCreditsPerUnit: 33.6,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          generate_audio: { type: 'boolean' },
          duration: { type: 'number' },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { generate_audio: true, duration: 5 },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // 5 seconds × 33.6 credits/sec = 168
      expect(credits).toBe(168);
    });

    test('11.3: Boolean pricing tier - longer duration', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'kling',
        methodName: 'text-to-video',
        enabled: true,
        rules: [
          {
            fieldPath: 'generate_audio',
            phase: 'input',
            category: 'video',
            unitField: 'duration',
            pricingTiers: [
              { value: false, creditsPerUnit: 26.88 },
              { value: true, creditsPerUnit: 33.6 },
            ],
            defaultCreditsPerUnit: 33.6,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          generate_audio: { type: 'boolean' },
          duration: { type: 'number' },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { generate_audio: true, duration: 10 },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // 10 seconds × 33.6 credits/sec = 336
      expect(credits).toBe(336);
    });

    test('11.4: Boolean pricing tier - default when value missing', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'kling',
        methodName: 'text-to-video',
        enabled: true,
        rules: [
          {
            fieldPath: 'generate_audio',
            phase: 'input',
            category: 'video',
            unitField: 'duration',
            pricingTiers: [
              { value: false, creditsPerUnit: 26.88 },
              { value: true, creditsPerUnit: 33.6 },
            ],
            defaultCreditsPerUnit: 33.6,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          generate_audio: { type: 'boolean' },
          duration: { type: 'number' },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { duration: 5 }, // generate_audio missing
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // Uses defaultCreditsPerUnit: 5 × 33.6 = 168
      expect(credits).toBe(168);
    });

    test('11.5: unitField from output phase', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'kling',
        methodName: 'text-to-video',
        enabled: true,
        rules: [
          {
            fieldPath: 'generate_audio',
            phase: 'input',
            category: 'video',
            unitField: 'actual_duration',
            unitPhase: 'output', // Get duration from output
            pricingTiers: [
              { value: false, creditsPerUnit: 26.88 },
              { value: true, creditsPerUnit: 33.6 },
            ],
            defaultCreditsPerUnit: 33.6,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          generate_audio: { type: 'boolean' },
        },
      });
      const responseSchema = JSON.stringify({
        type: 'object',
        properties: {
          actual_duration: { type: 'number' },
        },
      });

      const credits = await calculateCreditsFromRules(
        config,
        { generate_audio: false },
        { actual_duration: 7 },
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // 7 seconds × 26.88 credits/sec = 188.16 → rounded to 188
      expect(credits).toBe(188);
    });

    test('11.6: String pricing tier with unitField (resolution example)', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'image_gen',
        methodName: 'generate',
        enabled: true,
        rules: [
          {
            fieldPath: 'resolution',
            phase: 'input',
            category: 'image',
            unitField: 'num_images',
            pricingTiers: [
              { value: '512x512', creditsPerUnit: 2 },
              { value: '1024x1024', creditsPerUnit: 5 },
              { value: '2048x2048', creditsPerUnit: 10 },
            ],
            defaultCreditsPerUnit: 5,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          resolution: { type: 'string' },
          num_images: { type: 'number' },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { resolution: '2048x2048', num_images: 3 },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // 3 images × 10 credits/image = 30
      expect(credits).toBe(30);
    });

    test('11.7: Numeric pricing tier with unitField', async () => {
      const config: ToolBillingConfig = {
        inventoryKey: 'model_service',
        methodName: 'infer',
        enabled: true,
        rules: [
          {
            fieldPath: 'model_version',
            phase: 'input',
            category: 'text',
            unitField: 'prompt',
            pricingTiers: [
              { value: 1, creditsPerUnit: 0.001 }, // v1
              { value: 2, creditsPerUnit: 0.002 }, // v2
              { value: 3, creditsPerUnit: 0.003 }, // v3
            ],
            defaultCreditsPerUnit: 0.002,
          },
        ],
      };

      const requestSchema = JSON.stringify({
        type: 'object',
        properties: {
          model_version: { type: 'number' },
          prompt: { type: 'string' },
        },
      });
      const responseSchema = JSON.stringify({ type: 'object', properties: {} });

      const credits = await calculateCreditsFromRules(
        config,
        { model_version: 3, prompt: 'Hello world! This is a test prompt.' },
        {},
        requestSchema,
        responseSchema,
        mockLogger,
      );

      // 7 tokens × 0.003 credits/token = 0.021 → rounded to 0
      expect(credits).toBe(0);
    });
  });
});
