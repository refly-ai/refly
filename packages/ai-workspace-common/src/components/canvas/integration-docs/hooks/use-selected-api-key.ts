import { useState, useEffect } from 'react';
import type { CliApiKeyInfo } from '@refly/openapi-schema';

interface SelectedApiKey {
  keyId: string;
  name: string;
  keyPrefix: string;
  fullKey?: string;
}

const normalizeSelectedKey = (key: CliApiKeyInfo): SelectedApiKey => ({
  keyId: key.keyId,
  name: key.name,
  keyPrefix: key.keyPrefix,
});

export const useSelectedApiKey = (apiKeys: CliApiKeyInfo[]) => {
  const [selectedKey, setSelectedKey] = useState<SelectedApiKey | null>(null);

  useEffect(() => {
    if (apiKeys.length > 0 && !selectedKey) {
      // Select the most recently used or created key
      const sortedKeys = [...apiKeys].sort((a, b) => {
        const aTime = a.lastUsedAt || a.createdAt;
        const bTime = b.lastUsedAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setSelectedKey(normalizeSelectedKey(sortedKeys[0]));
    }
  }, [apiKeys, selectedKey]);

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}****${key.slice(-4)}`;
  };

  return {
    selectedKey,
    setSelectedKey,
    maskApiKey,
    hasKeys: apiKeys.length > 0,
  };
};
