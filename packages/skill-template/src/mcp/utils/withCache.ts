import cacheService from './CacheService';

/**
 * 缓存函数类型
 */
export type CachedFunction<T extends unknown[], R> = (...args: T) => Promise<R>;

/**
 * 高阶函数，为任意异步函数添加缓存能力
 * @param fn 原始函数
 * @param getCacheKey 缓存键生成函数
 * @param ttl 缓存生存时间（毫秒）
 * @param logPrefix 日志前缀
 * @returns 带缓存的包装函数
 */
export function withCache<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  getCacheKey: (...args: T) => string,
  ttl: number,
  logPrefix = '[Cache]',
): CachedFunction<T, R> {
  return async (...args: T): Promise<R> => {
    const cacheKey = getCacheKey(...args);

    if (cacheService.has(cacheKey)) {
      console.log(`${logPrefix} loaded from cache: ${cacheKey}`);
      const cachedData = cacheService.get<R>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    console.log(`${logPrefix} cache miss: ${cacheKey}`);
    const result = await fn(...args);
    cacheService.set(cacheKey, result, ttl);
    return result;
  };
}

export default withCache;
