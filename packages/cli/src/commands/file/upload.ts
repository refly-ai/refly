/**
 * refly file upload - Upload file(s) to a canvas
 * Uses presigned URL flow: presign -> PUT to OSS -> confirm
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ok, fail, ErrorCodes, isPrettyOutput } from '../../utils/output.js';
import { apiUploadDriveFile, type DriveFileUploadResult } from '../../api/client.js';
import { CLIError } from '../../utils/errors.js';
import { getFormatter } from '../../utils/formatter.js';

const MAX_FILES = 10;

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export const fileUploadCommand = new Command('upload')
  .description('Upload file(s) to a canvas')
  .argument('<path>', 'File or directory path')
  .requiredOption('--canvas-id <id>', 'Canvas ID (required)')
  .option('--filter <extensions>', 'Filter by extensions (e.g., pdf,docx,png)')
  .action(async (inputPath: string, options: { canvasId: string; filter?: string }) => {
    const formatter = getFormatter();

    try {
      // Resolve and validate path
      const resolvedPath = path.resolve(inputPath);

      if (!fs.existsSync(resolvedPath)) {
        fail(ErrorCodes.NOT_FOUND, `Path not found: ${inputPath}`, {
          hint: 'Check if the file or directory exists',
        });
      }

      // Get list of files to upload
      const files = resolveFilesToUpload(resolvedPath, options.filter);

      if (files.length === 0) {
        fail(ErrorCodes.NOT_FOUND, 'No files found to upload', {
          hint: options.filter
            ? `No files matching filter: ${options.filter}`
            : 'Directory is empty or contains no files',
        });
      }

      if (isPrettyOutput()) {
        console.log(`Found ${files.length} file(s) to upload`);
      }

      // Upload files sequentially
      const results: DriveFileUploadResult[] = [];
      const errors: Array<{ file: string; error: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const filename = path.basename(filePath);
        const fileStats = fs.statSync(filePath);
        const sizeStr = formatSize(fileStats.size);

        // Track current stage for progress display
        let currentStage: 'presign' | 'upload' | 'confirm' = 'presign';

        const updateProgress = () => {
          if (!isPrettyOutput()) return;

          let stageText: string;
          switch (currentStage) {
            case 'presign':
              stageText = `Getting upload URL for ${filename}...`;
              break;
            case 'upload':
              stageText = `Uploading ${filename} (${sizeStr})...`;
              break;
            case 'confirm':
              stageText = 'Confirming upload...';
              break;
          }
          formatter.progress(`[${i + 1}/${files.length}] ${stageText}`);
        };

        updateProgress();

        try {
          const result = await apiUploadDriveFile(filePath, options.canvasId, {
            onProgress: (stage) => {
              currentStage = stage;
              updateProgress();
            },
          });
          results.push(result);

          if (isPrettyOutput()) {
            formatter.clearProgress();
            console.log(
              `[${i + 1}/${files.length}] Uploading ${filename} (${sizeStr})... ✓ ${result.fileId}`,
            );
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push({ file: filename, error: errorMsg });

          if (isPrettyOutput()) {
            formatter.clearProgress();
            console.log(
              `[${i + 1}/${files.length}] Uploading ${filename} (${sizeStr})... ✗ ${errorMsg}`,
            );
          }
        }
      }

      formatter.clearProgress();

      // Determine exit status and message
      if (results.length === 0) {
        // All failed
        fail(ErrorCodes.INTERNAL_ERROR, 'All uploads failed', {
          details: { errors },
          hint: 'Check file permissions and network connection',
        });
      }

      // At least one success - show summary
      const message =
        errors.length > 0
          ? `Uploaded ${results.length} of ${files.length} file(s)`
          : `Successfully uploaded ${results.length} file(s)`;

      ok('file.upload', {
        message,
        canvasId: options.canvasId,
        uploaded: results.length,
        failed: errors.length,
        files: results.map((r) => ({
          fileId: r.fileId,
          name: r.name,
          type: r.type,
          size: r.size,
        })),
        ...(errors.length > 0 && { errors }),
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
        error instanceof Error ? error.message : 'Failed to upload files',
      );
    }
  });

/**
 * Resolve files to upload from a path.
 * - Single file: returns [filePath]
 * - Directory: returns up to MAX_FILES files, sorted by size (ascending)
 */
function resolveFilesToUpload(inputPath: string, filter?: string): string[] {
  const stats = fs.statSync(inputPath);

  if (stats.isFile()) {
    // Single file - check filter if specified
    if (filter) {
      const filterExts = filter.split(',').map((e) => e.trim().toLowerCase());
      const ext = path.extname(inputPath).slice(1).toLowerCase();
      if (!filterExts.includes(ext)) {
        return []; // File doesn't match filter
      }
    }
    return [inputPath];
  }

  if (stats.isDirectory()) {
    const entries = fs.readdirSync(inputPath);
    const filterExts = filter?.split(',').map((e) => e.trim().toLowerCase());

    const files = entries
      .map((e) => path.join(inputPath, e))
      .filter((p) => {
        try {
          return fs.statSync(p).isFile();
        } catch {
          return false;
        }
      })
      .filter((p) => {
        if (!filterExts) return true;
        const ext = path.extname(p).slice(1).toLowerCase();
        return filterExts.includes(ext);
      })
      // Sort by file size ascending (smaller files first)
      .sort((a, b) => {
        try {
          return fs.statSync(a).size - fs.statSync(b).size;
        } catch {
          return 0;
        }
      })
      .slice(0, MAX_FILES);

    return files;
  }

  return [];
}
