import { CacheItem } from '../core/types';

/**
 * 缓存服务
 * 提供内存缓存功能，支持TTL过期
 */
export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, CacheItem<any>> = new Map();

  /**
   * 私有构造函数，确保单例模式
   */
  private constructor() {
    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 60000); // 每分钟清理一次
  }

  /**
   * 获取缓存服务实例
   * @returns 缓存服务实例
   */
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * 清理过期缓存
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 检查缓存项是否存在且未过期
   * @param key 缓存键
   * @returns 是否存在有效的缓存项
   */
  public has(key: string): boolean {
    if (!this.cache.has(key)) {
      return false;
    }
    const item = this.cache.get(key)!;
    if (item.expiry < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 获取缓存项的值
   * @param key 缓存键
   * @returns 缓存值，若不存在或已过期则返回undefined
   */
  public get<T>(key: string): T | undefined {
    if (!this.has(key)) {
      return undefined;
    }
    return this.cache.get(key)!.value as T;
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（毫秒）
   */
  public set<T>(key: string, value: T, ttl: number): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  public remove(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  public clear(): void {
    this.cache.clear();
  }
}

// 导出单例
const cacheService = CacheService.getInstance();
export default cacheService;
