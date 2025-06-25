import { useCallback } from 'react';

// Global variables shared across all hook instances
export const globalAbortControllerRef = { current: null as AbortController | null };
export const globalIsAbortedRef = { current: false };
export const globalCurrentResultIdRef = { current: '' as string };

export const useAbortAction = () => {
  const abortAction = useCallback(async (resultId?: string, _msg?: string) => {
    console.log('=== ABORT ACTION CALLED ===');
    console.log('resultId:', resultId);
    console.log('globalAbortControllerRef.current:', globalAbortControllerRef.current);
    console.log('globalIsAbortedRef.current:', globalIsAbortedRef.current);

    // Use current active resultId if none provided
    const activeResultId = resultId || globalCurrentResultIdRef.current;
    console.log('activeResultId:', activeResultId);

    try {
      // Abort the local controller
      if (globalAbortControllerRef.current) {
        console.log('Aborting local controller...');
        globalAbortControllerRef.current.abort();
        globalIsAbortedRef.current = true;
        console.log('Local controller aborted');
      } else {
        console.log('No local controller to abort');
      }

      // If resultId is provided and is a valid string, call the backend to clean up server-side resources
      if (activeResultId && typeof activeResultId === 'string' && activeResultId.trim() !== '') {
        console.log('Calling backend abort API with resultId:', activeResultId);
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

      console.log('=== ABORT ACTION COMPLETED ===');
    } catch (err) {
      console.error('shutdown error', err);
    }
  }, []);

  return { abortAction };
};
