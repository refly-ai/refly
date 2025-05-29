import { useEffect, useState } from 'react';
import { storage } from '@refly-packages/ai-workspace-common/utils/storage';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import { logger } from '@/utils/logger';

export type StorageLocation = 'local' | 'sync' | 'session' | 'managed';

export const useStorage = <T>(
  key: string,
  defaultVal: T,
  location: 'local' | 'sync' | 'session' | 'managed' = 'local',
): [T, (val: T) => void] => {
  const [storageValue, setStorageValue] = useState<T>(defaultVal);
  const storageItem = storage.defineItem<T>(`${location}:${key}`);

  const syncStorageValue = async (newStorageValue: T) => {
    await storageItem.setValue(newStorageValue);
    setStorageValue(newStorageValue);
  };

  const getInitStorageValue = async () => {
    const val = await storage.getItem(`${location}:${key}`);

    if (!val) {
      setStorageValue(defaultVal);
    } else {
      setStorageValue(val as T);
    }
  };

  useEffect(() => {
    storageItem.watch((newValue) => {
      logger.debug('new Syn storage value', newValue);
      setStorageValue(newValue as T);
    });
  }, []);

  useEffect(() => {
    getInitStorageValue();
  }, []);

  return [storageValue, syncStorageValue];
};

export const handleGetAndWatchValue = async <T>(
  key: string,
  location: StorageLocation,
  onCallback: (val: T) => void,
) => {
  // 默认对 storage 都序列化
  const val = await storage.getItem(`${location}:${key}`);

  // 可能已经有了，直接设置
  if (val) {
    onCallback(safeParseJSON(val));
  }

  // 否则 watch 更新
  storage.watch(`${location}:${key}`, (newVal: T | null) => {
    onCallback(safeParseJSON(newVal) as T);
  });
};

// just watch some storage and then get notify
export const useWatchStorage = <T>(
  key: string,

  location: StorageLocation = 'local',
): [T | undefined, (val: T) => void] => {
  const [storageValue, setStorageValue] = useState<T>();

  useEffect(() => {
    handleGetAndWatchValue<T>(key, location, (val: T) => setStorageValue(val));
  }, []);

  return [storageValue, setStorageValue];
};
