/**
 * refly file - File command group
 */

import { Command } from 'commander';
import { fileListCommand } from './list.js';
import { fileGetCommand } from './get.js';
import { fileDownloadCommand } from './download.js';
import { fileUploadCommand } from './upload.js';

export const fileCommand = new Command('file')
  .description('Manage files and documents')
  .addCommand(fileListCommand)
  .addCommand(fileGetCommand)
  .addCommand(fileDownloadCommand)
  .addCommand(fileUploadCommand);
