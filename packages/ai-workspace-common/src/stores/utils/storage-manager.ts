import { StateStorage } from 'zustand/middleware';

/**
 * Interface for objects with cache timestamp information
 */
export interface CacheInfo {
  lastUsedAt?: number;
}

// Type guard to check if an object implements CacheInfo
function isCacheInfo(obj: any): obj is CacheInfo {
  return (
    obj &&
    typeof obj === 'object' &&
    (obj.lastUsedAt === undefined || typeof obj.lastUsedAt === 'number')
  );
}

/**
 * Options for configuring the ZustandStorageManager
 */
export interface AutoEvictionStorageManagerOptions {
  /** Maximum age in milliseconds before item is considered stale (default: 1 day) */
  maxAge?: number;
  /** Maximum number of items to keep per state field (default: 50) */
  maxItems?: number;
  /** Maximum storage size in bytes (default: 500KB) */
  maxSize?: number;
  /** Debug mode for logging (default: false) */
  debug?: boolean;
}

/**
 * Custom storage manager for Zustand that handles LRU eviction
 * based on lastUsedAt timestamps in stored objects
 */
export class AutoEvictionStorageManager implements StateStorage {
  private options: Required<AutoEvictionStorageManagerOptions>;
  private readonly ONE_DAY_MS = 24 * 60 * 60 * 1000;
  private readonly DEFAULT_MAX_SIZE = 500 * 1024; // 500KB
  private readonly DEFAULT_MAX_ITEMS = 50;

  constructor(options: AutoEvictionStorageManagerOptions = {}) {
    this.options = {
      maxAge: options.maxAge ?? this.ONE_DAY_MS,
      maxItems: options.maxItems ?? this.DEFAULT_MAX_ITEMS,
      maxSize: options.maxSize ?? this.DEFAULT_MAX_SIZE,
      debug: options.debug ?? process.env.NODE_ENV !== 'production',
    };
  }

  /**
   * Log debug messages when debug mode is enabled
   */
  private log(...args: any[]) {
    if (this.options.debug) {
      console.log('[AutoEvictionStorageManager]', ...args);
    }
  }

  /**
   * Estimate the size of a string in bytes
   */
  private getStringByteSize(str: string): number {
    return new Blob([str]).size;
  }

  /**
   * Performs eviction on objects that implement CacheInfo
   * Keeps most recently used items based on lastUsedAt
   */
  private evictStaleItems(state: Record<string, any>): Record<string, any> {
    if (!state || typeof state !== 'object') return state;

    const now = Date.now();
    const cutoffTime = now - this.options.maxAge;
    const result = { ...state };
    let modified = false;

    // Process each top-level field in the state
    for (const key in result) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        const value = result[key];

        // Only process objects
        if (!value || typeof value !== 'object') continue;

        // Handle arrays of objects with CacheInfo
        if (Array.isArray(value)) {
          // Filter out stale items and sort by lastUsedAt (newest first)
          const filteredItems = value
            .filter(
              (item) =>
                item &&
                typeof item === 'object' &&
                isCacheInfo(item) &&
                (item.lastUsedAt === undefined || item.lastUsedAt > cutoffTime),
            )
            .sort(
              (a, b) => ((b as CacheInfo).lastUsedAt ?? 0) - ((a as CacheInfo).lastUsedAt ?? 0),
            );

          // Trim to max items
          if (filteredItems.length > this.options.maxItems) {
            result[key] = filteredItems.slice(0, this.options.maxItems);
            this.log(`Trimmed array ${key} from ${value.length} to ${result[key].length} items`);
            modified = true;
          } else if (filteredItems.length !== value.length) {
            result[key] = filteredItems;
            this.log(
              `Removed ${value.length - filteredItems.length} stale items from array ${key}`,
            );
            modified = true;
          }
        }
        // Handle record objects (maps) containing CacheInfo objects
        else if (Object.keys(value).length > 0) {
          const entries = Object.entries(value);
          const validEntries = entries
            .filter(
              ([, item]) =>
                item &&
                typeof item === 'object' &&
                isCacheInfo(item) &&
                (item.lastUsedAt === undefined || item.lastUsedAt > cutoffTime),
            )
            .sort(
              ([, a], [, b]) =>
                ((b as CacheInfo).lastUsedAt ?? 0) - ((a as CacheInfo).lastUsedAt ?? 0),
            );

          // Trim to max items
          if (validEntries.length > this.options.maxItems) {
            result[key] = Object.fromEntries(validEntries.slice(0, this.options.maxItems));
            this.log(
              `Trimmed object ${key} from ${entries.length} to ${Object.keys(result[key]).length} entries`,
            );
            modified = true;
          } else if (validEntries.length !== entries.length) {
            result[key] = Object.fromEntries(validEntries);
            this.log(
              `Removed ${entries.length - validEntries.length} stale entries from object ${key}`,
            );
            modified = true;
          }
        }
      }
    }

    return modified ? result : state;
  }

  /**
   * Apply size-based eviction if state exceeds maxSize
   */
  private applySizeBasedEviction(state: Record<string, any>): Record<string, any> {
    if (!state || typeof state !== 'object') return state;

    const serialized = JSON.stringify(state);
    let currentSize = this.getStringByteSize(serialized);

    // If already under size limit, no need to evict
    if (currentSize <= this.options.maxSize) {
      return state;
    }

    this.log(
      `State size (${currentSize}) exceeds max size (${this.options.maxSize}), applying eviction`,
    );

    const result = { ...state };
    let modified = false;

    // Process each top-level field in the state
    for (const key in result) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        const value = result[key];

        // Only process objects
        if (!value || typeof value !== 'object') continue;

        // Handle arrays of objects with CacheInfo
        if (Array.isArray(value) && value.length > 1) {
          // Sort by lastUsedAt (newest first)
          const sorted = [...value].sort(
            (a, b) => ((b as CacheInfo).lastUsedAt ?? 0) - ((a as CacheInfo).lastUsedAt ?? 0),
          );

          // Start with 75% of items and keep reducing
          let keepCount = Math.ceil(sorted.length * 0.75);

          while (keepCount > 1) {
            const reducedArray = sorted.slice(0, keepCount);
            const tempState = { ...result, [key]: reducedArray };
            const tempSize = this.getStringByteSize(JSON.stringify(tempState));

            if (tempSize <= this.options.maxSize) {
              result[key] = reducedArray;
              this.log(`Reduced array ${key} from ${value.length} to ${keepCount} items`);
              modified = true;
              break;
            }

            // Reduce by half each time
            keepCount = Math.max(1, Math.floor(keepCount * 0.5));
          }

          // If we got all the way down to 1 item, just keep that one
          if (keepCount === 1 && !modified && value.length > 1) {
            result[key] = [sorted[0]];
            this.log(`Reduced array ${key} to just 1 item (from ${value.length})`);
            modified = true;
          }
        }
        // Handle record objects (maps) containing CacheInfo objects
        else if (!Array.isArray(value) && Object.keys(value).length > 1) {
          const entries = Object.entries(value);

          // Sort by lastUsedAt (newest first)
          const sorted = entries.sort(
            ([, a], [, b]) =>
              ((b as CacheInfo).lastUsedAt ?? 0) - ((a as CacheInfo).lastUsedAt ?? 0),
          );

          // Start with 75% of items and keep reducing
          let keepCount = Math.ceil(sorted.length * 0.75);

          while (keepCount > 1) {
            const reducedObj = Object.fromEntries(sorted.slice(0, keepCount));
            const tempState = { ...result, [key]: reducedObj };
            const tempSize = this.getStringByteSize(JSON.stringify(tempState));

            if (tempSize <= this.options.maxSize) {
              result[key] = reducedObj;
              this.log(`Reduced object ${key} from ${entries.length} to ${keepCount} entries`);
              modified = true;
              break;
            }

            // Reduce by half each time
            keepCount = Math.max(1, Math.floor(keepCount * 0.5));
          }

          // If we got all the way down to 1 entry, just keep that one
          if (keepCount === 1 && !modified && entries.length > 1) {
            const [[topKey, topValue]] = sorted;
            result[key] = { [topKey]: topValue };
            this.log(`Reduced object ${key} to just 1 entry (from ${entries.length})`);
            modified = true;
          }
        }
      }

      // Check if we're now under the size limit
      if (modified) {
        currentSize = this.getStringByteSize(JSON.stringify(result));
        if (currentSize <= this.options.maxSize) {
          this.log(`Eviction successful, new size: ${currentSize} bytes`);
          break;
        }
      }
    }

    return modified ? result : state;
  }

  /**
   * Process state before storage to handle eviction
   */
  private processState(state: Record<string, any>): Record<string, any> {
    // First evict stale items based on age
    let processedState = this.evictStaleItems(state);

    // Then apply size-based eviction if needed
    processedState = this.applySizeBasedEviction(processedState);

    return processedState;
  }

  /**
   * Implements StateStorage.getItem
   */
  getItem(name: string): string | null {
    try {
      const value = localStorage.getItem(name);
      return value;
    } catch (error) {
      this.log(`Error retrieving item ${name}:`, error);
      return null;
    }
  }

  /**
   * Implements StateStorage.setItem with eviction logic
   */
  setItem(name: string, value: string): void {
    try {
      // Parse the value to extract state and version
      const parsedValue = JSON.parse(value);
      const { state, version } = parsedValue;

      if (!state || typeof state !== 'object') {
        // If there's no state field or it's not an object, store as-is
        localStorage.setItem(name, value);
        return;
      }

      // Process only the state part to handle eviction
      const processedState = this.processState(state);

      // Reconstruct the value with processed state and original version
      const processedValue = JSON.stringify({
        state: processedState,
        version,
      });

      localStorage.setItem(name, processedValue);
      this.log(`Stored item: ${name}, size: ${this.getStringByteSize(processedValue)} bytes`);
    } catch (error) {
      this.log(`Error storing item ${name}:`, error);

      // Try to store the original value as fallback
      try {
        localStorage.setItem(name, value);
      } catch (fallbackError) {
        this.log(`Fallback store failed for ${name}:`, fallbackError);

        // Last resort: try to remove other items to make space
        try {
          this.clearOtherStorage();
          localStorage.setItem(name, value);
        } catch (finalError) {
          this.log(`Final attempt failed for ${name}:`, finalError);
        }
      }
    }
  }

  /**
   * Implements StateStorage.removeItem
   */
  removeItem(name: string): void {
    try {
      localStorage.removeItem(name);
      this.log(`Removed item: ${name}`);
    } catch (error) {
      this.log(`Error removing item ${name}:`, error);
    }
  }

  /**
   * Clear other storage to make room
   */
  private clearOtherStorage(): void {
    try {
      // Get a list of all storage keys
      const keys = Object.keys(localStorage);

      // First try to remove temporary or cache items
      for (const key of keys) {
        if (key.includes('temp') || key.includes('cache') || key.includes('log')) {
          localStorage.removeItem(key);
        }
      }

      // If we still need space, remove older items based on their timestamps
      for (const key of keys) {
        try {
          const item = localStorage.getItem(key);
          if (!item) continue;

          const data = JSON.parse(item);
          // Check if this is a Zustand persisted store with state field
          if (data?.state && typeof data.state === 'object') {
            // Get the timestamp from the state object
            const timestamp = this.getLatestTimestamp(data.state);
            if (timestamp && Date.now() - timestamp > this.options.maxAge) {
              localStorage.removeItem(key);
              this.log(`Evicted old item: ${key}`);
            }
          }
        } catch (error) {
          // Skip if we can't parse this item
          this.log(`Error parsing item ${key} during clearOtherStorage:`, error);
        }
      }
    } catch (error) {
      this.log('Error clearing other storage:', error);
    }
  }

  /**
   * Get the most recent timestamp from any CacheInfo object in the state
   */
  private getLatestTimestamp(data: any): number | null {
    if (!data || typeof data !== 'object') return null;

    let latestTimestamp: number | null = null;

    // Check if this object has a lastUsedAt property
    if (data.lastUsedAt && typeof data.lastUsedAt === 'number') {
      latestTimestamp = data.lastUsedAt;
    }

    // Also recursively check any nested objects
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value && typeof value === 'object') {
          // If it's an array, check each item
          if (Array.isArray(value)) {
            for (const item of value) {
              if (item && typeof item === 'object') {
                const timestamp = this.getLatestTimestamp(item);
                if (timestamp && (latestTimestamp === null || timestamp > latestTimestamp)) {
                  latestTimestamp = timestamp;
                }
              }
            }
          }
          // Otherwise check the object directly
          else {
            const timestamp = this.getLatestTimestamp(value);
            if (timestamp && (latestTimestamp === null || timestamp > latestTimestamp)) {
              latestTimestamp = timestamp;
            }
          }
        }
      }
    }

    return latestTimestamp;
  }
}

/**
 * Creates a auto eviction storage object for Zustand's persist middleware
 */
export const createAutoEvictionStorage = (options: AutoEvictionStorageManagerOptions = {}) => {
  const storageManager = new AutoEvictionStorageManager(options);
  return storageManager;
};

/**
 * Example usage:
 *
 * import { create } from 'zustand';
 * import { persist } from 'zustand/middleware';
 * import { createAutoEvictionStorage } from './storage-manager';
 *
 * const useStore = create(
 *   persist(
 *     (set) => ({
 *       // your state and actions
 *       items: []
 *     }),
 *     {
 *       name: 'store-name',
 *       storage: createAutoEvictionStorage({
 *         maxItems: 50,
 *         maxAge: 24 * 60 * 60 * 1000, // 1 day
 *         debug: process.env.NODE_ENV !== 'production'
 *       })
 *     }
 *   )
 * );
 *
 * // Note: The storage manager now expects to receive the full key name in setItem
 * // and works directly with the state structure provided by Zustand persist middleware,
 * // which includes { state: {...}, version: number }
 */
