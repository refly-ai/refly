import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translateText } from './translate';

describe('translate retry behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should wait for Retry-After before retrying a 429 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '60' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [[['hola']]],
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = translateText('hello', 'es');
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59000);

    await expect(result).resolves.toBe('hola');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
