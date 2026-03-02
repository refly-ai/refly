/**
 * Billing Service - Unit Tests
 *
 * Tests the processBilling method's credit resolution logic:
 * - Direct price paths (0, valid, invalid)
 * - Dynamic billing
 * - Legacy billing fallback
 * - Dynamic fail → legacy success
 * - Explicit no-charge (billingConfig.enabled === false)
 * - No billing source → warning
 * - Free toolset with/without access
 * - Invalid input guards
 * - NaN/Infinity from dynamic calc
 * - Minimum credit floor for sub-credit dynamic billing
 */

import { Logger } from '@nestjs/common';
import { BillingService } from './billing.service';
import type { ProcessBillingOptions } from './billing.dto';

// ---- Mocks ----

// Mock tool-context (always returns deterministic values)
jest.mock('../tool-context', () => ({
  getResultId: () => 'test-result-id',
  getResultVersion: () => 1,
  getToolCallId: () => 'test-tool-call-id',
}));

// Mock legacy billing
jest.mock('../utils/billing', () => ({
  calculateCredits: jest.fn().mockReturnValue(5),
}));

// Mock dynamic billing
jest.mock('../utils/billing-calculation', () => ({
  calculateCreditsFromRules: jest.fn().mockResolvedValue(10),
}));

// Mock runModuleInitWithTimeoutAndRetry to just call the fn
jest.mock('@refly/utils', () => ({
  runModuleInitWithTimeoutAndRetry: jest.fn(async (fn: () => Promise<void>) => {
    await fn();
  }),
}));

// Mock SingleFlightCache
jest.mock('../../../utils/cache', () => ({
  SingleFlightCache: jest.fn().mockImplementation((loader: () => Promise<any>) => {
    let cached: any = null;
    return {
      get: async () => {
        if (!cached) cached = await loader();
        return cached;
      },
      set: (val: any) => {
        cached = val;
      },
    };
  }),
}));

// Get references to mocked functions
const { calculateCredits } = jest.requireMock('../utils/billing');
const { calculateCreditsFromRules } = jest.requireMock('../utils/billing-calculation');

describe('BillingService.processBilling', () => {
  let service: BillingService;
  let mockPrisma: any;
  let mockCreditService: any;
  let mockRedis: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock PrismaService
    mockPrisma = {
      toolBilling: {
        findMany: jest.fn().mockResolvedValue([
          {
            inventoryKey: 'test_tool',
            methodName: 'generate',
            billingRules: [
              {
                fieldPath: 'prompt',
                phase: 'input',
                category: 'text',
                defaultCreditsPerUnit: 1,
              },
            ],
            tokenPricing: null,
          },
          {
            inventoryKey: 'nano_banana_pro',
            methodName: 'generate',
            billingRules: [
              {
                fieldPath: 'prompt',
                phase: 'input',
                category: 'text',
                defaultCreditsPerUnit: 1,
              },
            ],
            tokenPricing: null,
          },
        ]),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      creditAccumulatorSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    // Mock CreditService
    mockCreditService = {
      syncToolCreditUsage: jest.fn().mockResolvedValue(undefined),
    };

    // Mock RedisService — simulate accumulator that always flushes immediately
    const mockClient = {
      exists: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockImplementation(async (...args: any[]) => {
        const microCredits = Number(args[2]);
        const scale = Number(args[5]);
        const flushCredits = Math.floor(microCredits / scale);
        const remainder = microCredits - flushCredits * scale;
        return [flushCredits, remainder, 0]; // [flush, remainder, replayed]
      }),
      scan: jest.fn().mockResolvedValue(['0', []]),
      get: jest.fn().mockResolvedValue('0'),
      set: jest.fn().mockResolvedValue('OK'),
    };

    mockRedis = {
      getClient: () => mockClient,
      get: jest.fn().mockResolvedValue('0'),
      setex: jest.fn().mockResolvedValue('OK'),
      existsBoolean: jest.fn().mockResolvedValue(false),
    };

    // Construct service
    service = new BillingService(mockPrisma, mockCreditService, mockRedis);
    await service.onModuleInit();
  });

  function baseOptions(overrides: Partial<ProcessBillingOptions> = {}): ProcessBillingOptions {
    return {
      uid: 'user-1',
      toolName: 'generate',
      toolsetKey: 'test_tool',
      ...overrides,
    };
  }

  // ---- Direct Price Tests ----

  test('1: Direct discountedPrice=0 returns success with 0 cost', async () => {
    const result = await service.processBilling(
      baseOptions({ discountedPrice: 0, originalPrice: 5 }),
    );
    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(0);
    expect(result.originalPrice).toBe(5);
  });

  test('2: Direct discountedPrice > 0 uses provided value', async () => {
    const result = await service.processBilling(
      baseOptions({ discountedPrice: 3.5, originalPrice: 7 }),
    );
    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(3.5);
    expect(result.originalPrice).toBe(7);
  });

  test('3: Invalid discountedPrice (NaN) returns error', async () => {
    const result = await service.processBilling(baseOptions({ discountedPrice: Number.NaN }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid discountedPrice');
  });

  test('4: Invalid discountedPrice (negative) returns error', async () => {
    const result = await service.processBilling(baseOptions({ discountedPrice: -5 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid discountedPrice');
  });

  test('5: Invalid originalPrice (Infinity) returns error', async () => {
    const result = await service.processBilling(
      baseOptions({ discountedPrice: 5, originalPrice: Number.POSITIVE_INFINITY }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid originalPrice');
  });

  // ---- Dynamic Billing Tests ----

  test('6: Dynamic billing uses calculateCreditsFromRules', async () => {
    calculateCreditsFromRules.mockResolvedValueOnce(25);

    const result = await service.processBilling(
      baseOptions({
        input: { prompt: 'test' },
        output: {},
        requestSchema: '{"type":"object","properties":{"prompt":{"type":"string"}}}',
        responseSchema: '{"type":"object","properties":{}}',
      }),
    );

    expect(result.success).toBe(true);
    expect(calculateCreditsFromRules).toHaveBeenCalled();
    // discountedPrice should reflect the dynamic result
    expect(result.discountedPrice).toBe(25);
  });

  // ---- Legacy Billing Fallback ----

  test('7: Legacy billing used when no dynamic config', async () => {
    calculateCredits.mockReturnValueOnce(8);

    const result = await service.processBilling(
      baseOptions({
        toolsetKey: 'unknown_tool', // No dynamic config
        billingConfig: { enabled: true, type: 'PER_CALL', creditsPerCall: 8 } as any,
        params: {},
      }),
    );

    expect(result.success).toBe(true);
    expect(calculateCredits).toHaveBeenCalled();
  });

  // ---- Dynamic Fail → Legacy Success ----

  test('8: Dynamic billing fails, falls back to legacy', async () => {
    calculateCreditsFromRules.mockRejectedValueOnce(new Error('schema parse error'));
    calculateCredits.mockReturnValueOnce(3);

    const result = await service.processBilling(
      baseOptions({
        input: { prompt: 'test' },
        output: {},
        requestSchema: '{"type":"object"}',
        responseSchema: '{}',
        billingConfig: { enabled: true, type: 'PER_CALL', creditsPerCall: 3 } as any,
        params: {},
      }),
    );

    expect(result.success).toBe(true);
    expect(calculateCreditsFromRules).toHaveBeenCalled();
    expect(calculateCredits).toHaveBeenCalled();
  });

  // ---- Explicit No-Charge ----

  test('9: billingConfig.enabled=false → 0 credits', async () => {
    const result = await service.processBilling(
      baseOptions({
        billingConfig: { enabled: false } as any,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(0);
    // Should NOT call dynamic or legacy billing
    expect(calculateCreditsFromRules).not.toHaveBeenCalled();
    expect(calculateCredits).not.toHaveBeenCalled();
  });

  // ---- No Billing Source Warning ----

  test('10: No billing source resolved → warning logged, 0 credits', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');

    const result = await service.processBilling(
      baseOptions({
        toolsetKey: 'some_unknown_tool', // Not in FREE_TOOLSET_KEYS
      }),
    );

    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(0);
    // Verify warning was logged about missing billing source
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No billing source resolved'));

    warnSpy.mockRestore();
  });

  // ---- Free Toolset ----

  test('11: FREE_TOOLSET_KEYS tool with active subscription → 0 credits', async () => {
    calculateCreditsFromRules.mockResolvedValueOnce(50);
    // Simulate active free-access subscription
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-1' });

    const result = await service.processBilling(
      baseOptions({
        toolsetKey: 'nano_banana_pro', // In FREE_TOOLSET_KEYS
        input: { prompt: 'test' },
        output: {},
        requestSchema: '{"type":"object","properties":{"prompt":{"type":"string"}}}',
        responseSchema: '{"type":"object","properties":{}}',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(0);
    expect(mockPrisma.subscription.findFirst).toHaveBeenCalled();
  });

  test('12: FREE_TOOLSET_KEYS tool without subscription → charges normally', async () => {
    calculateCreditsFromRules.mockResolvedValueOnce(50);
    mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);

    const result = await service.processBilling(
      baseOptions({
        toolsetKey: 'nano_banana_pro',
        input: { prompt: 'test' },
        output: {},
        requestSchema: '{"type":"object","properties":{"prompt":{"type":"string"}}}',
        responseSchema: '{"type":"object","properties":{}}',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(50);
  });

  test('13: FREE_TOOLSET_KEYS tool with no billing source → no warning', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');

    const result = await service.processBilling(
      baseOptions({
        toolsetKey: 'fish_audio', // In FREE_TOOLSET_KEYS
      }),
    );

    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(0);
    // Should NOT warn about missing billing source for free toolsets
    const warnCalls = warnSpy.mock.calls.map((c) => c[0]);
    const hasNoSourceWarning = warnCalls.some(
      (msg: string) => typeof msg === 'string' && msg.includes('No billing source resolved'),
    );
    expect(hasNoSourceWarning).toBe(false);

    warnSpy.mockRestore();
  });

  // ---- Default Price ----

  test('14: Default finalDiscountedPrice is 0 (not 1)', async () => {
    // No discountedPrice, no schemas, no billingConfig → should default to 0
    const result = await service.processBilling(
      baseOptions({
        toolsetKey: 'some_unknown_tool',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(0);
    // The old default of 1 would cause a non-zero charge
  });

  // ---- NaN/Infinity from dynamic calc ----

  test('15: NaN from dynamic calc is caught and reset to 0', async () => {
    calculateCreditsFromRules.mockResolvedValueOnce(Number.NaN);

    const result = await service.processBilling(
      baseOptions({
        toolsetKey: 'test_tool', // Has dynamic config
        input: { prompt: 'test' },
        output: {},
        requestSchema: '{"type":"object","properties":{"prompt":{"type":"string"}}}',
        responseSchema: '{"type":"object","properties":{}}',
      }),
    );

    expect(result.success).toBe(true);
    // NaN gets caught by finiteness guard and reset to 0
    expect(result.discountedPrice).toBe(0);
  });

  // ---- Minimum Credit Floor for Dynamic Billing ----

  test('16: Sub-credit dynamic billing (0.18) is floored to 1', async () => {
    // Simulates short TTS text producing 0.18 credits (< flush threshold)
    calculateCreditsFromRules.mockResolvedValueOnce(0.18);

    const result = await service.processBilling(
      baseOptions({
        input: { text: 'hello' },
        output: {},
        requestSchema: '{"type":"object","properties":{"text":{"type":"string"}}}',
        responseSchema: '{"type":"object","properties":{}}',
      }),
    );

    expect(result.success).toBe(true);
    // 0.18 credits should be floored to minimum 1 credit
    expect(result.discountedPrice).toBe(1);
    expect(result.originalPrice).toBe(1);
  });

  test('17: Zero dynamic billing stays at 0 (no minimum applied)', async () => {
    calculateCreditsFromRules.mockResolvedValueOnce(0);

    const result = await service.processBilling(
      baseOptions({
        input: { text: '' },
        output: {},
        requestSchema: '{"type":"object","properties":{"text":{"type":"string"}}}',
        responseSchema: '{"type":"object","properties":{}}',
      }),
    );

    expect(result.success).toBe(true);
    // 0 credits should NOT be floored to 1 (tool produced no billable work)
    expect(result.discountedPrice).toBe(0);
  });

  test('18: Dynamic billing at exactly 1 stays at 1 (floor not applied)', async () => {
    calculateCreditsFromRules.mockResolvedValueOnce(1);

    const result = await service.processBilling(
      baseOptions({
        input: { text: 'medium text' },
        output: {},
        requestSchema: '{"type":"object","properties":{"text":{"type":"string"}}}',
        responseSchema: '{"type":"object","properties":{}}',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(1);
  });

  test('19: Dynamic billing above 1 (1.5) stays unchanged', async () => {
    calculateCreditsFromRules.mockResolvedValueOnce(1.5);

    const result = await service.processBilling(
      baseOptions({
        input: { text: 'longer text' },
        output: {},
        requestSchema: '{"type":"object","properties":{"text":{"type":"string"}}}',
        responseSchema: '{"type":"object","properties":{}}',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.discountedPrice).toBe(1.5);
  });
});
