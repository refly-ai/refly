/**
 * Interactive prompt utilities for CLI user input.
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Check if the current session is running in an interactive terminal (TTY).
 * Non-interactive contexts include piped input, CI environments, etc.
 */
export function isInteractive(): boolean {
  return process.stdin?.isTTY ?? false;
}

/**
 * Prompt the user for a file path with validation.
 * Re-prompts on invalid input until a valid file is provided or user skips (for optional variables).
 *
 * @param variableName - Name of the variable (for display)
 * @param resourceTypes - Allowed file types (e.g., ['document', 'image'])
 * @param isRequired - Whether the variable is required
 * @returns Resolved absolute file path, or null if skipped (optional only)
 */
export async function promptForFilePath(
  variableName: string,
  resourceTypes: string[],
  isRequired: boolean,
): Promise<string | null> {
  const rl = readline.createInterface({ input, output });
  const typeHint = resourceTypes.length > 0 ? resourceTypes.join('/') : 'file';
  const requiredHint = isRequired ? 'required' : 'optional, press Enter to skip';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const answer = await rl.question(`  ${variableName} (${requiredHint}, ${typeHint}): `);

      const trimmed = answer.trim();

      // Handle empty input
      if (!trimmed) {
        if (!isRequired) {
          return null;
        }
        console.log('    This variable is required. Please enter a file path.');
        continue;
      }

      // Expand ~ to home directory
      let resolvedPath = trimmed;
      if (resolvedPath.startsWith('~')) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        resolvedPath = resolvedPath.replace('~', homeDir);
      }

      // Resolve to absolute path
      resolvedPath = path.resolve(resolvedPath);

      // Validate file exists
      if (!fs.existsSync(resolvedPath)) {
        console.log(`    File not found: ${resolvedPath}`);
        continue;
      }

      // Validate it's a file (not a directory)
      const stats = fs.statSync(resolvedPath);
      if (!stats.isFile()) {
        console.log(`    Not a file: ${resolvedPath}`);
        continue;
      }

      return resolvedPath;
    }
  } finally {
    rl.close();
  }
}
