/**
 * refly drive - Drive command group
 */

import { Command } from 'commander';
import { driveListCommand } from './list.js';
import { driveGetCommand } from './get.js';
import { driveDownloadCommand } from './download.js';

export const driveCommand = new Command('drive')
  .description('Manage drive files and documents')
  .addCommand(driveListCommand)
  .addCommand(driveGetCommand)
  .addCommand(driveDownloadCommand);
