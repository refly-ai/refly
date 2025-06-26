import { useCallback } from 'react';

// Global variables shared across all hook instances
export const globalAbortControllerRef = { current: null as AbortController | null };
export const globalIsAbortedRef = { current: false };
export const globalCurrentResultIdRef = { current: '' as string };

export const useAbortAction = () => {
  const abortAction = useCallback(async (resultId?: string, _msg?: string) => {
    // Use current active resultId if none provided
    const activeResultId = resultId || globalCurrentResultIdRef.current;

    try {
      // Abort the local controller
      if (globalAbortControllerRef.current) {
        globalAbortControllerRef.current.abort();
        globalIsAbortedRef.current = true;
      } else {
        console.log('No local controller to abort');
      }

      // If resultId is provided and is a valid string, call the backend to clean up server-side resources
      if (activeResultId && typeof activeResultId === 'string' && activeResultId.trim() !== '') {
        try {
          // Use direct fetch since abortAction is not in the generated client yet
          const { serverOrigin } = await import('@refly-packages/ai-workspace-common/utils/env');

          const response = await fetch(`${serverOrigin}/v1/action/abort`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ resultId: activeResultId }),
          });

          console.log('Backend abort API response status:', response.status);

          if (response.ok) {
            console.log('Backend abort API succeeded');
          } else {
            console.warn('Failed to abort action on server:', response.status);
          }
        } catch (serverError) {
          console.error('Error calling server abort API:', serverError);
        }
      } else {
        console.log('No valid resultId provided, skipping backend call');
        console.log('activeResultId details:', {
          activeResultId,
          type: typeof activeResultId,
          isEmpty: !activeResultId,
        });
      }
    } catch (err) {
      console.error('abort error', err);
    }
  }, []);

  return { abortAction };
};
