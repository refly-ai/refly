export interface CacheInfo {
  lastUsedAt?: number;
  createdAt?: number;
  accessedAt?: number;
}

interface StorageConfig {
  maxSize?: number;
  maxAge?: number;
  evictionPolicy?: 'lru' | 'fifo' | 'lifo';
}

// Create auto-eviction storage for managing cache size
export const createAutoEvictionStorage = (config: StorageConfig = {}) => {
  const { maxSize = 50, maxAge = 7 * 24 * 60 * 60 * 1000 } = config;

  return {
    getItem: (name: string) => {
      try {
        const item = localStorage.getItem(name);
        if (!item) return null;

        const parsed = JSON.parse(item);

        // Check if item is expired
        if (parsed.state?.lastUsedAt && Date.now() - parsed.state.lastUsedAt > maxAge) {
          localStorage.removeItem(name);
          return null;
        }

        return parsed;
      } catch (error) {
        console.error('Error reading from storage:', error);
        return null;
      }
    },
    setItem: (name: string, value: any) => {
      try {
        localStorage.setItem(name, JSON.stringify(value));

        // Simple eviction: remove oldest items if we have too many
        const keys = Object.keys(localStorage).filter(
          (key) => key.startsWith('canvas-') || key.startsWith('document-'),
        );
        if (keys.length > maxSize) {
          // Remove the oldest items
          keys.sort((a, b) => {
            const aTime = localStorage.getItem(a);
            const bTime = localStorage.getItem(b);
            if (!aTime || !bTime) return 0;

            try {
              const aParsed = JSON.parse(aTime);
              const bParsed = JSON.parse(bTime);
              return (aParsed.state?.lastUsedAt || 0) - (bParsed.state?.lastUsedAt || 0);
            } catch {
              return 0;
            }
          });

          // Remove oldest 20% of items
          const toRemove = Math.ceil(keys.length * 0.2);
          for (const key of keys.slice(0, toRemove)) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.error('Error writing to storage:', error);
      }
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name);
      } catch (error) {
        console.error('Error removing from storage:', error);
      }
    },
  };
};
