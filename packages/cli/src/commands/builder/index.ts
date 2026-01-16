/**
 * refly builder - Builder command group
 */

import { Command } from 'commander';
import { builderStartCommand } from './start.js';
import { builderStatusCommand } from './status.js';
import { builderAddNodeCommand } from './add-node.js';
import { builderUpdateNodeCommand } from './update-node.js';
import { builderRemoveNodeCommand } from './remove-node.js';
import { builderConnectCommand } from './connect.js';
import { builderDisconnectCommand } from './disconnect.js';
import { builderGraphCommand } from './graph.js';
import { builderValidateCommand } from './validate.js';
import { builderCommitCommand } from './commit.js';
import { builderAbortCommand } from './abort.js';

export const builderCommand = new Command('builder')
  .description('Build workflows incrementally with local state')
  .addCommand(builderStartCommand)
  .addCommand(builderStatusCommand)
  .addCommand(builderAddNodeCommand)
  .addCommand(builderUpdateNodeCommand)
  .addCommand(builderRemoveNodeCommand)
  .addCommand(builderConnectCommand)
  .addCommand(builderDisconnectCommand)
  .addCommand(builderGraphCommand)
  .addCommand(builderValidateCommand)
  .addCommand(builderCommitCommand)
  .addCommand(builderAbortCommand);
