/**
 * refly file list - List files
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequest } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';

interface FileInfo {
  fileId: string;
  name: string;
  type: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
}

interface ListFilesResponse {
  files: FileInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export const fileListCommand = new Command('list')
  .description('List files')
  .option('--page <n>', 'Page number (default: 1)', '1')
  .option('--page-size <n>', 'Number of files per page (default: 20)', '20')
  .option('--canvas-id <id>', 'Filter by canvas ID')
  .option('--result-id <id>', 'Filter by action result ID')
  .option('--include-content', 'Include file content in response')
  .action(async (options) => {
    try {
      const params = new URLSearchParams({
        page: options.page,
        pageSize: options.pageSize,
      });
      if (options.canvasId) {
        params.set('canvasId', options.canvasId);
      }
      if (options.resultId) {
        params.set('resultId', options.resultId);
      }
      if (options.includeContent) {
        params.set('includeContent', 'true');
      }

      const result = await apiRequest<ListFilesResponse>(`/v1/cli/drive/files?${params}`);

      ok('file.list', {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        files: result.files?.map((f) => ({
          fileId: f.fileId,
          name: f.name,
          type: f.type,
          size: f.size,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
      });
    } catch (error) {
      if (error instanceof CLIError) {
        fail(error.code, error.message, {
          details: error.details,
          hint: error.hint,
          suggestedFix: error.suggestedFix,
        });
      }
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to list files',
      );
    }
  });
