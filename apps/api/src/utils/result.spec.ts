jest.mock('@refly/utils', () => ({
  aggregateTokenUsage: (items: unknown[]) => items ?? [],
}));

import { ResultAggregator } from './result';
import type { StepService } from '../modules/step/step.service';

describe('ResultAggregator', () => {
  const resultId = 'result-1';
  const version = 1;
  const cacheKey = `steps:${resultId}:${version}`;

  let setCacheCalls: Array<{ key: string; steps: Record<string, unknown> }>;
  let clearCacheCalls: Array<{ resultId: string; version: number }>;
  let stepService: jest.Mocked<Pick<StepService, 'buildCacheKey' | 'setCache' | 'clearCache'>>;
  let aggregator: ResultAggregator;

  beforeEach(() => {
    jest.useFakeTimers();
    setCacheCalls = [];
    clearCacheCalls = [];

    stepService = {
      buildCacheKey: jest.fn().mockReturnValue(cacheKey),
      setCache: jest
        .fn()
        .mockImplementation(async (key: string, steps: Record<string, unknown>) => {
          setCacheCalls.push({ key, steps });
        }),
      clearCache: jest.fn().mockImplementation(async (rid: string, ver: number) => {
        clearCacheCalls.push({ resultId: rid, version: ver });
      }),
    };

    aggregator = new ResultAggregator(stepService as unknown as StepService, resultId, version);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces rapid handleStreamContent into fewer setCache calls than events', async () => {
    const meta = { step: { name: 'answer' } };
    const chunks = ['Hello', ' ', 'world', '!', ' more'];

    for (const chunk of chunks) {
      aggregator.handleStreamContent(meta as any, chunk);
    }

    expect(setCacheCalls).toHaveLength(0);

    jest.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();

    expect(setCacheCalls.length).toBeGreaterThanOrEqual(1);
    expect(setCacheCalls.length).toBeLessThan(chunks.length);

    const steps = await aggregator.getSteps({ resultId, version });
    expect(steps).toHaveLength(1);
    expect(steps[0].content).toBe('Hello world! more');

    const lastWrite = setCacheCalls[setCacheCalls.length - 1];
    expect(lastWrite.key).toBe(cacheKey);
    expect((lastWrite.steps.answer as { content: string }).content).toBe('Hello world! more');
  });

  it('does not recreate Redis key via setCache after clearCache (in-flight + post-clear)', async () => {
    let resolveSet: (() => void) | undefined;
    const setGate = new Promise<void>((resolve) => {
      resolveSet = resolve;
    });

    stepService.setCache.mockImplementation(async (key: string, steps: Record<string, unknown>) => {
      setCacheCalls.push({ key, steps });
      await setGate;
    });

    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, 'partial');
    jest.advanceTimersByTime(200);
    // Allow flush to start and hit the gated setCache
    await Promise.resolve();
    await Promise.resolve();

    expect(stepService.setCache).toHaveBeenCalled();
    const callsBeforeClear = setCacheCalls.length;

    const clearPromise = aggregator.clearCache();
    // Mutation while clear awaits in-flight write
    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, ' after-clear-race');

    resolveSet?.();
    await clearPromise;

    // Drain any microtasks / timers that might try to rearm
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    await Promise.resolve();

    expect(clearCacheCalls).toEqual([{ resultId, version }]);
    expect(setCacheCalls.length).toBe(callsBeforeClear);

    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, ' post-clear');
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    await Promise.resolve();

    expect(setCacheCalls.length).toBe(callsBeforeClear);

    const steps = await aggregator.getSteps({ resultId, version });
    expect(steps[0].content).toContain('partial');
    expect(steps[0].content).toContain('after-clear-race');
    expect(steps[0].content).toContain('post-clear');
    expect(setCacheCalls.length).toBe(callsBeforeClear);
  });

  it('mutation after clearCache does not call setCache again', async () => {
    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, 'before');
    jest.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();

    expect(setCacheCalls.length).toBeGreaterThanOrEqual(1);
    const afterFirstPersist = setCacheCalls.length;

    await aggregator.clearCache();
    expect(clearCacheCalls).toEqual([{ resultId, version }]);

    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, ' after');
    aggregator.addUsageItem(
      { step: { name: 'answer' } } as any,
      {
        modelName: 'm',
        modelProvider: 'p',
        inputTokens: 1,
        outputTokens: 1,
      } as any,
    );

    jest.advanceTimersByTime(500);
    await Promise.resolve();
    await aggregator.getSteps({ resultId, version });

    expect(setCacheCalls.length).toBe(afterFirstPersist);
  });
});
