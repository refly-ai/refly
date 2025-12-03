import { del, get, set, update } from 'idb-keyval';
import { ensureIndexedDbSupport } from './indexeddb';

type StoreKey = IDBValidKey;

// Fallback in-memory store to prevent crashes when IndexedDB is unavailable.
const memoryStore = new Map<StoreKey, unknown>();

const useMemoryStore = async () => {
  const supported = await ensureIndexedDbSupport();
  return !supported;
};

export const safeGet = async <T>(key: StoreKey): Promise<T | undefined> => {
  if (await useMemoryStore()) {
    return memoryStore.get(key) as T | undefined;
  }
  return get<T>(key);
};

export const safeSet = async <T>(key: StoreKey, value: T): Promise<void> => {
  if (await useMemoryStore()) {
    memoryStore.set(key, value);
    return;
  }
  await set(key, value);
};

export const safeUpdate = async <T>(
  key: StoreKey,
  updater: (oldValue: T | undefined) => T,
): Promise<void> => {
  if (await useMemoryStore()) {
    const current = memoryStore.get(key) as T | undefined;
    const nextValue = updater(current);
    memoryStore.set(key, nextValue);
    return;
  }
  await update<T>(key, updater);
};

export const safeDel = async (key: StoreKey): Promise<void> => {
  if (await useMemoryStore()) {
    memoryStore.delete(key);
    return;
  }
  await del(key);
};
