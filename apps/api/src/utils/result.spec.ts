jest.mock('@refly/utils', () => ({
  aggregateTokenUsage: (items: unknown[]) => items ?? [],
}));

import { PERSIST_DEBOUNCE_MS, ResultAggregator } from './result';
import type { StepService } from '../modules/step/step.service';

/** Flush fake timers + microtasks (jest env here lacks advanceTimersByTimeAsync). */
async function advanceAndFlush(ms: number) {
  jest.advanceTimersByTime(ms);
  // Drain promise chains from timer → persistOnce → setCache
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

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

    await advanceAndFlush(PERSIST_DEBOUNCE_MS);

    expect(setCacheCalls.length).toBeGreaterThanOrEqual(1);
    expect(setCacheCalls.length).toBeLessThan(chunks.length);

    const steps = await aggregator.getSteps({ resultId, version });
    expect(steps).toHaveLength(1);
    expect(steps[0].content).toBe('Hello world! more');

    const lastWrite = setCacheCalls[setCacheCalls.length - 1];
    expect(lastWrite.key).toBe(cacheKey);
    expect((lastWrite.steps.answer as { content: string }).content).toBe('Hello world! more');
  });

  it('re-debounces mutations that arrive during an in-flight write (no immediate back-to-back loop)', async () => {
    let resolveSet: (() => void) | undefined;
    const setGate = new Promise<void>((resolve) => {
      resolveSet = resolve;
    });

    stepService.setCache.mockImplementation(async (key: string, steps: Record<string, unknown>) => {
      setCacheCalls.push({ key, steps });
      await setGate;
    });

    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, 'a');
    await advanceAndFlush(PERSIST_DEBOUNCE_MS);

    expect(setCacheCalls).toHaveLength(1);

    // Mutations while first write is still in flight
    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, 'b');
    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, 'c');

    // Completing the write must not immediately issue another setCache
    resolveSet?.();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    expect(setCacheCalls).toHaveLength(1);

    // Follow-up write only after another debounce window
    await advanceAndFlush(PERSIST_DEBOUNCE_MS);
    expect(setCacheCalls).toHaveLength(2);
    expect((setCacheCalls[1].steps.answer as { content: string }).content).toBe('abc');
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
    await advanceAndFlush(PERSIST_DEBOUNCE_MS);

    expect(stepService.setCache).toHaveBeenCalled();
    const callsBeforeClear = setCacheCalls.length;

    const clearPromise = aggregator.clearCache();
    // Mutation while clear awaits in-flight write
    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, ' after-clear-race');

    resolveSet?.();
    await clearPromise;

    // Drain any microtasks / timers that might try to rearm
    await advanceAndFlush(PERSIST_DEBOUNCE_MS * 2);

    expect(clearCacheCalls).toEqual([{ resultId, version }]);
    expect(setCacheCalls.length).toBe(callsBeforeClear);

    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, ' post-clear');
    await advanceAndFlush(PERSIST_DEBOUNCE_MS * 2);

    expect(setCacheCalls.length).toBe(callsBeforeClear);

    const steps = await aggregator.getSteps({ resultId, version });
    expect(steps[0].content).toContain('partial');
    expect(steps[0].content).toContain('after-clear-race');
    expect(steps[0].content).toContain('post-clear');
    expect(setCacheCalls.length).toBe(callsBeforeClear);
  });

  it('mutation after clearCache does not call setCache again', async () => {
    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, 'before');
    await advanceAndFlush(PERSIST_DEBOUNCE_MS);

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

    await advanceAndFlush(PERSIST_DEBOUNCE_MS * 2);
    await aggregator.getSteps({ resultId, version });

    expect(setCacheCalls.length).toBe(afterFirstPersist);
  });

  it('abort flushes pending snapshot and rejects further schedule', async () => {
    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, 'pending');
    expect(setCacheCalls).toHaveLength(0);

    aggregator.abort();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    expect(setCacheCalls.length).toBeGreaterThanOrEqual(1);
    expect((setCacheCalls[0].steps.answer as { content: string }).content).toBe('pending');

    const afterAbort = setCacheCalls.length;
    aggregator.handleStreamContent({ step: { name: 'answer' } } as any, ' ignored');
    aggregator.addUsageItem(
      { step: { name: 'answer' } } as any,
      {
        modelName: 'm',
        modelProvider: 'p',
        inputTokens: 1,
        outputTokens: 1,
      } as any,
    );
    await advanceAndFlush(PERSIST_DEBOUNCE_MS * 2);

    expect(setCacheCalls.length).toBe(afterAbort);
  });
});
