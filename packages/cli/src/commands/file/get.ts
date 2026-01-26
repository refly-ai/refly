/**
 * refly file get - Get file details
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
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export const fileGetCommand = new Command('get')
  .description('Get file details')
  .argument('<fileId>', 'File ID')
  .option('--no-content', 'Exclude file content from response')
  .action(async (fileId, options) => {
    try {
      const includeContent = options.content !== false;
      const result = await apiRequest<FileInfo>(
        `/v1/cli/drive/files/${fileId}?includeContent=${includeContent}`,
      );

      ok('file.get', {
        fileId: result.fileId,
        name: result.name,
        type: result.type,
        size: result.size,
        content: includeContent ? result.content : undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
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
        error instanceof Error ? error.message : 'Failed to get file',
      );
    }
  });
