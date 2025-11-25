import { extractBaseResp } from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { scrollToBottom } from '@refly-packages/ai-workspace-common/utils/ui';
import { AuthenticationExpiredError, ConnectionError } from '@refly/errors';
import { InvokeSkillRequest, SkillEvent } from '@refly/openapi-schema';
import { isDesktop, serverOrigin } from '@refly/ui-kit';
import throttle from 'lodash.throttle';
import { refreshToken } from './auth';

// Create throttled version of scrollToBottom function
const throttledScrollToBottom = throttle(() => {
  // Use requestAnimationFrame to ensure scrolling happens at the best time
  window.requestAnimationFrame(() => {
    scrollToBottom();
  });
}, 300); // Execute at most once every 300ms

const makeSSERequest = async (
  payload: InvokeSkillRequest,
  controller: AbortController,
  isRetry = false,
): Promise<Response> => {
  console.log('isDesktop', isDesktop());
  const response = await fetch(`${serverOrigin}/v1/skill/streamInvoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: isDesktop() ? 'omit' : 'include',
    signal: controller.signal,
    body: JSON.stringify(payload),
  });

  if (response?.status === 401 && !isRetry) {
    try {
      await refreshToken();
      return makeSSERequest(payload, controller, true);
    } catch (error) {
      if (error instanceof AuthenticationExpiredError) {
        throw error;
      }
      // Convert error to string for ConnectionError constructor
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ConnectionError(errorMessage);
    }
  }

  return response;
};

export const ssePost = async ({
  controller,
  payload,
  onSkillLog,
  onSkillStart,
  onSkillStream,
  onToolCallStart,
  onToolCallStream,
  onSkillEnd,
  onSkillArtifact,
  onSkillStructedData,
  onSkillCreateNode,
  onSkillTokenUsage,
  onSkillError,
  onCompleted,
}: {
  controller: AbortController;
  payload: InvokeSkillRequest;
  onStart: () => void;
  onSkillLog: (event: SkillEvent) => void;
  onSkillStart: (event: SkillEvent) => void;
  onSkillStream: (event: SkillEvent) => void;
  onToolCallStart?: (event: SkillEvent) => void;
  onToolCallStream?: (event: SkillEvent) => void;
  onSkillEnd: (event: SkillEvent) => void;
  onSkillStructedData: (event: SkillEvent) => void;
  onSkillCreateNode: (event: SkillEvent) => void;
  onSkillArtifact: (event: SkillEvent) => void;
  onSkillTokenUsage?: (event: SkillEvent) => void;
  onSkillError?: (event: SkillEvent) => void;
  onCompleted?: (val?: boolean) => void;
}) => {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  // Batch processing state - defined at function level so finally block can access it
  const batchedEvents: SkillEvent[] = [];
  let batchTimer: number | null = null;

  try {
    const response = await makeSSERequest(payload, controller);

    const baseResp = await extractBaseResp(response, { success: true });
    if (!baseResp.success) {
      onSkillError?.({
        resultId: payload.resultId ?? '',
        error: baseResp,
        event: 'error',
      });
      return;
    }

    reader = response.body?.getReader() ?? null;
    const decoder = new TextDecoder('utf-8');
    let isSkillFirstMessage = true;
    let bufferStr = '';

    // Improved batching configuration
    let processingBatch = false;
    const BATCH_SIZE = 30; // Maximum number of events to process at once
    const BATCH_INTERVAL = 250; // Time between batch processing in ms
    let lastProcessTime = 0;
    const THROTTLE_TIMEOUT = 100; // Minimum time between batch processing

    // Process accumulated events in batches
    const processBatch = () => {
      if (batchedEvents.length === 0 || processingBatch) return;

      const now = performance.now();
      // Skip if not enough time has passed and batch isn't very large
      if (now - lastProcessTime < THROTTLE_TIMEOUT && batchedEvents.length < BATCH_SIZE * 2) {
        return;
      }

      processingBatch = true;
      lastProcessTime = now;

      // Get all events to process and clear the batch
      const eventsToProcess = [...batchedEvents];
      batchedEvents.length = 0;

      // Group events by type for more efficient processing
      const eventsByType: Record<string, SkillEvent[]> = {};

      // Group events by type
      for (const event of eventsToProcess) {
        const eventType = event?.event || 'unknown';
        if (!eventsByType[eventType]) {
          eventsByType[eventType] = [];
        }
        eventsByType[eventType].push(event);
      }

      // Use requestAnimationFrame to sync with browser rendering
      requestAnimationFrame(() => {
        // Handle start events
        if (eventsByType.start?.length) {
          const lastStartEvent = eventsByType.start[eventsByType.start.length - 1];
          if (isSkillFirstMessage) {
            onSkillStart(lastStartEvent);
          }
        }

        // Handle log events
        if (eventsByType.log?.length) {
          for (const event of eventsByType.log) {
            onSkillLog(event);
          }
        }

        // Handle stream events - combine content when possible
        if (eventsByType.stream?.length) {
          // Use the last event as a template
          const lastEvent = eventsByType.stream[eventsByType.stream.length - 1];
          // Create a copy to avoid mutation issues
          const combinedEvent = { ...lastEvent };

          // Combine all content
          combinedEvent.content = eventsByType.stream.map((e) => e.content || '').join('');

          // Combine reasoning content
          combinedEvent.reasoningContent = eventsByType.stream
            .map((e) => e.reasoningContent || '')
            .join('');

          onSkillStream(combinedEvent);
        }

        // Process remaining event types (less performance-critical)
        if (eventsByType.tool_call_stream?.length) {
          for (const event of eventsByType.tool_call_stream) {
            onToolCallStream?.(event);
          }
        }

        if (eventsByType.artifact?.length) {
          for (const event of eventsByType.artifact) {
            onSkillArtifact(event);
          }
        }

        if (eventsByType.structured_data?.length) {
          for (const event of eventsByType.structured_data) {
            onSkillStructedData(event);
          }
        }

        if (eventsByType.create_node?.length) {
          for (const event of eventsByType.create_node) {
            onSkillCreateNode(event);
          }
        }

        if (eventsByType.token_usage?.length) {
          for (const event of eventsByType.token_usage) {
            onSkillTokenUsage?.(event);
          }
        }

        if (eventsByType.end?.length) {
          for (const event of eventsByType.end) {
            onSkillEnd(event);
            isSkillFirstMessage = true;
          }
        }

        if (eventsByType.error?.length) {
          for (const event of eventsByType.error) {
            onSkillError?.(event);
          }
        }

        // Scroll after processing if needed
        if (eventsToProcess.length > 0) {
          throttledScrollToBottom();
        }

        processingBatch = false;
      });
    };

    // Schedule batch processing
    const scheduleBatchProcessing = () => {
      if (batchTimer !== null) return; // Already scheduled

      batchTimer = window.setTimeout(() => {
        processBatch();
        batchTimer = null;

        // Schedule next batch if there are pending events
        if (batchedEvents.length > 0) {
          scheduleBatchProcessing();
        }
      }, BATCH_INTERVAL);
    };

    const read = async () => {
      let hasError = false;
      try {
        if (!reader) {
          throw new Error('Reader is not initialized');
        }
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining events
          processBatch();
          onCompleted?.();
          // Final scroll to bottom
          scrollToBottom();
          return;
        }

        bufferStr += decoder.decode(value, { stream: true });
        const lines = bufferStr.split('\n');
        bufferStr = lines[lines.length - 1]; // Keep the last incomplete line

        try {
          // Process all complete lines
          for (let i = 0; i < lines.length - 1; i++) {
            const message = lines[i];
            if (message.startsWith('data: ')) {
              try {
                const skillEvent = JSON.parse(message.substring(6)) as SkillEvent;
                if (skillEvent.event === 'tool_call_start') {
                  onToolCallStart?.(skillEvent);
                  continue;
                }
                batchedEvents.push(skillEvent);
              } catch (err) {
                console.log('Parse error:', {
                  message: message.substring(6),
                  error: err,
                });
              }
            }
          }

          // Schedule batch processing if we have events
          if (batchedEvents.length > 0 && batchTimer === null) {
            scheduleBatchProcessing();
          }
        } catch (err) {
          // Create a proper SkillEvent for the error
          const errorEvent: SkillEvent = {
            resultId: payload.resultId ?? '',
            event: 'error',
            error: {
              success: false,
              errCode: 'PARSE_ERROR',
              errMsg: err instanceof Error ? err.message : String(err),
            },
          };
          onSkillError?.(errorEvent);
          onCompleted?.(true);
          hasError = true;
          return;
        }

        if (!hasError) {
          await read();
        }
      } catch (err) {
        // Type guard for AbortError
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Read operation aborted');
          return;
        }
      }
    };

    await read();
  } catch (error) {
    // Type guard for AbortError
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Fetch aborted');
    } else {
      console.error('Fetch error:', error);
      // Convert error to string for ConnectionError constructor
      const errorMessage = error instanceof Error ? error.message : String(error);
      onSkillError?.({
        resultId: payload.resultId ?? '',
        error: {
          success: false,
          errCode: new ConnectionError(errorMessage).code,
        },
        event: 'error',
      });
    }
  } finally {
    // Clear batch processing state to prevent stale events from processing after abort
    if (batchTimer !== null) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    batchedEvents.length = 0;

    // Clean up reader resources
    if (reader) {
      try {
        await reader.cancel();
      } catch (cancelError) {
        console.error('Error cancelling reader:', cancelError);
      }
      reader.releaseLock();
    }
  }
};
