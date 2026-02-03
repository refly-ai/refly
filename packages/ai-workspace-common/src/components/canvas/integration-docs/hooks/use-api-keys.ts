import { useState, useEffect } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { CliApiKeyInfo, CreateCliApiKeyData } from '@refly/openapi-schema';

type ApiKey = CliApiKeyInfo;

export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const response = await getClient().listCliApiKeys();
      const result = response.data;
      if (result?.success) {
        setApiKeys(result.data || []);
      } else {
        setApiKeys([]);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async (name: string): Promise<CreateCliApiKeyData> => {
    const response = await getClient().createCliApiKey({
      body: { name },
    });
    const result = response.data;
    if (!result?.success || !result.data) {
      throw new Error('Failed to create API key');
    }
    await fetchApiKeys();
    return result.data;
  };

  const renameApiKey = async (keyId: string, name: string) => {
    await getClient().updateCliApiKey({
      path: { keyId },
      body: { name },
    });
    await fetchApiKeys();
  };

  const deleteApiKey = async (keyId: string) => {
    await getClient().revokeCliApiKey({
      path: { keyId },
    });
    await fetchApiKeys();
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  return {
    apiKeys,
    loading,
    createApiKey,
    renameApiKey,
    deleteApiKey,
    refetch: fetchApiKeys,
  };
};
