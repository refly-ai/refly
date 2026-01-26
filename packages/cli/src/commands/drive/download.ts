/**
 * refly drive download - Download file to local filesystem
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { apiRequestStream } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const driveDownloadCommand = new Command('download')
  .description('Download file to local filesystem')
  .argument('<fileId>', 'File ID')
  .option('-o, --output <path>', 'Output file path (defaults to original filename)')
  .action(async (fileId, options) => {
    try {
      const { data, filename, contentType, size } = await apiRequestStream(
        `/v1/cli/drive/files/${fileId}/download`,
      );

      const outputPath = options.output || filename || `${fileId}`;
      const resolvedPath = path.resolve(outputPath);

      // Write buffer to file
      fs.writeFileSync(resolvedPath, data);

      ok('drive.download', {
        fileId,
        path: resolvedPath,
        filename,
        contentType,
        size,
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
        error instanceof Error ? error.message : 'Failed to download file',
      );
    }
  });
