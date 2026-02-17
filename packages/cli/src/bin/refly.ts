/**
 * Refly CLI - Main entry point
 *
 * Supports multiple output formats: json, pretty, compact, plain.
 * Exit codes: 0=success, 1=error, 2=auth, 3=validation, 4=network, 5=not found
 */

import { Command } from 'commander';
import { fail, ErrorCodes, configureOutput, type OutputFormat } from '../utils/output.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Read version from package.json
function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

// Import commands
import { initCommand } from '../commands/init.js';
import { loginCommand } from '../commands/login.js';
import { logoutCommand } from '../commands/logout.js';
import { statusCommand } from '../commands/status.js';
import { whoamiCommand } from '../commands/whoami.js';
import { upgradeCommand } from '../commands/upgrade.js';
import { configCommand } from '../commands/config.js';
import { workflowCommand } from '../commands/workflow/index.js';
import { toolCommand } from '../commands/tool/index.js';
import { fileCommand } from '../commands/file/index.js';
import { skillCommand } from '../commands/skill/index.js';
import { platformCommand } from '../commands/platform/index.js';

const VERSION = getVersion();

const program = new Command();

program
  .name('refly')
  .description('Refly CLI - Workflow orchestration for Claude Code')
  .version(VERSION, '-v, --version', 'Output CLI version')
  .option('--host <url>', 'API endpoint override')
  .option('--debug', 'Enable debug logging')
  .option(
    '-f, --format <format>',
    'Output format: json, pretty, compact, plain (default: auto-detect)',
  )
  .option('--no-color', 'Disable colored output')
  .option('--verbose', 'Enable verbose output');

// Global options handling
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();

  // Configure output format (must be done before any output)
  configureOutput({
    format: opts.format as OutputFormat | undefined,
    noColor: opts.color === false,
    verbose: opts.verbose ?? false,
    autoDetect: !opts.format, // Auto-detect only if format not explicitly set
  });

  // Set API endpoint override
  if (opts.host) {
    process.env.REFLY_API_ENDPOINT = opts.host;
  }

  // Enable debug logging
  if (opts.debug) {
    const { logger } = require('../utils/logger.js');
    logger.setLevel('debug');
    logger.enableFileLogging();
  }
});

// Add commands
program.addCommand(initCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(statusCommand);
program.addCommand(whoamiCommand);
program.addCommand(upgradeCommand);
program.addCommand(configCommand);
program.addCommand(workflowCommand);
program.addCommand(toolCommand);
program.addCommand(fileCommand);
program.addCommand(skillCommand);
program.addCommand(platformCommand);

// Error handling
program.exitOverride((err) => {
  // Commander throws errors for help/version which we should let through
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(0);
  }

  // Handle other commander errors
  fail(ErrorCodes.INVALID_INPUT, err.message, {
    details: { code: err.code },
    hint: 'Run `refly --help` for usage',
  });
});

// Catch unhandled errors
process.on('uncaughtException', (error) => {
  fail(ErrorCodes.INTERNAL_ERROR, error.message, {
    hint: 'Report this issue at https://github.com/refly-ai/refly/issues',
  });
});

process.on('unhandledRejection', (reason) => {
  fail(ErrorCodes.INTERNAL_ERROR, reason instanceof Error ? reason.message : String(reason), {
    hint: 'Report this issue at https://github.com/refly-ai/refly/issues',
  });
});

// Parse arguments
program.parse();
