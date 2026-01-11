import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { ExportJob } from '@refly/openapi-schema';

export type ExportType = 'markdown' | 'docx' | 'pdf';

const POLL_INTERVAL = 1000; // 1 second
const MAX_POLL_ATTEMPTS = 300; // 5 minutes max

/**
 * Custom error for cancelled export operations
 */
export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelledError';
  }
}

/**
 * Poll for export job completion
 */
const pollExportJob = async (
  jobId: string,
  onProgress?: (status: string) => void,
  signal?: AbortSignal,
): Promise<ExportJob> => {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    if (signal?.aborted) {
      throw new ExportCancelledError();
    }

    const { data, error } = await getClient().getExportJobStatus({
      path: { jobId },
    });

    if (error || !data?.data) {
      throw new Error('Failed to get export job status');
    }

    const job = data.data;
    onProgress?.(job.status);

    if (job.status === 'completed') {
      return job;
    }

    if (job.status === 'failed') {
      throw new Error(job.error || 'Export job failed');
    }

    // Wait before next poll, allow cancellation during wait
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(resolve, POLL_INTERVAL);
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timeoutId);
          reject(new ExportCancelledError());
          return;
        }
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeoutId);
            reject(new ExportCancelledError());
          },
          { once: true },
        );
      }
    });
    attempts++;
  }

  throw new Error('Export job timed out');
};

/**
 * Download export job result as blob
 */
const downloadExportResult = async (jobId: string): Promise<Blob> => {
  const response = await getClient().downloadExportJobResult({
    path: { jobId },
    parseAs: 'blob',
  });

  if (response.error || !response.data) {
    throw new Error('Failed to download export result');
  }

  return response.data as Blob;
};

export const useExportDocument = () => {
  /**
   * Export document using sync method (for markdown and simple text files)
   */
  const exportDocumentSync = async (fileId: string, format: ExportType = 'markdown') => {
    if (!fileId) return '';
    try {
      const { data, error } = await getClient().exportDocument({
        query: {
          fileId,
          format,
        },
      });

      if (error) {
        console.error('Export document failed:', error);
        return '';
      }

      return data || '';
    } catch (err) {
      console.error('Export document error:', err);
      return '';
    }
  };

  /**
   * Export document using async Lambda method (for pdf/docx conversion)
   * Returns a Blob that can be downloaded
   * Throws error with message if export fails
   * Throws ExportCancelledError if cancelled via signal
   */
  const exportDocumentAsync = async (
    fileId: string,
    format: 'pdf' | 'docx',
    onProgress?: (status: string) => void,
    signal?: AbortSignal,
  ): Promise<Blob> => {
    if (!fileId) {
      throw new Error('File ID is required');
    }

    if (signal?.aborted) {
      throw new ExportCancelledError();
    }

    // Start export job
    const { data: startData, error: startError } = await getClient().startExportJob({
      body: {
        fileId,
        format,
      },
    });

    if (startError || !startData?.data) {
      console.error('Failed to start export job:', startError);
      throw new Error('Failed to start export job');
    }

    const job = startData.data;
    onProgress?.('pending');

    // Poll for completion - will throw if job fails or cancelled
    const completedJob = await pollExportJob(job.jobId, onProgress, signal);

    // Download result
    const blob = await downloadExportResult(completedJob.jobId);
    return blob;
  };

  /**
   * Smart export - uses sync for markdown, async for pdf/docx
   * Returns string for markdown, Blob for pdf/docx
   * Throws error if export fails (for pdf/docx)
   * Throws ExportCancelledError if cancelled via signal
   */
  const exportDocument = async (
    fileId: string,
    format: ExportType = 'markdown',
    onProgress?: (status: string) => void,
    signal?: AbortSignal,
  ): Promise<string | Blob> => {
    if (format === 'markdown') {
      return exportDocumentSync(fileId, format);
    }
    return exportDocumentAsync(fileId, format as 'pdf' | 'docx', onProgress, signal);
  };

  return {
    exportDocument,
    exportDocumentSync,
    exportDocumentAsync,
  };
};
