import { useCallback, useState, useEffect, useMemo } from 'react';
import { staticPublicEndpoint } from '@refly/ui-kit';

/**
 * Hook to fetch share data with type safety
 * @template T - The expected type of the share data
 * @param shareId - The ID of the share to fetch
 * @returns Object containing loading state, error state, and fetched data
 */
export const useFetchShareData = <T = any>(shareId?: string) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Function to fetch share data
  const fetchShareData = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${staticPublicEndpoint}/share/${id}.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch share data: ${response?.status}`);
      }
      const responseData = await response.json();
      return responseData as T;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error occurred');
    }
  }, []);

  // Effect to fetch data when shareId changes
  useEffect(() => {
    // Reset state when shareId changes
    setData(null);
    setError(null);

    // Only fetch if shareId is provided and non-empty
    if (!shareId?.trim()) {
      return;
    }

    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await fetchShareData(shareId);
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [shareId, fetchShareData]);

  // Memoize the return value to maintain referential equality
  const returnValue = useMemo(
    () => ({
      data,
      loading,
      error,
      fetchShareData,
    }),
    [data, loading, error, fetchShareData],
  );

  return returnValue;
};
