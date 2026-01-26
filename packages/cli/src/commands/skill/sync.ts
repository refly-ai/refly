/**
 * refly skill sync - Validate and repair skill symlinks
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { listSkillSymlinks, createSkillSymlink, removeSkillSymlink } from '../../skill/symlink.js';
import { getReflySkillsDir } from '../../config/paths.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface SyncSummary {
  scanned: number;
  valid: number;
  invalid: number;
  repaired: number;
  orphans: number;
  warnings: number;
}

export const skillSyncCommand = new Command('sync')
  .description('Validate and repair skill symlinks')
  .option('--dry-run', 'Show issues without making changes')
  .option('--fix', 'Attempt to repair broken symlinks')
  .option('--prune', 'Remove orphan symlinks (symlinks without source directory)')
  .action(async (options) => {
    try {
      const symlinks = listSkillSymlinks();
      const warnings: string[] = [];
      const errors: string[] = [];

      let valid = 0;
      let invalid = 0;
      let repaired = 0;
      let orphans = 0;

      // Check each symlink
      for (const symlink of symlinks) {
        if (symlink.isValid) {
          valid += 1;
        } else {
          invalid += 1;
          warnings.push(`Invalid symlink: ${symlink.claudePath} -> ${symlink.target}`);

          if (options.fix && !options.dryRun) {
            // Try to repair by recreating the symlink
            const result = createSkillSymlink(symlink.name);
            if (result.success) {
              repaired += 1;
            } else {
              errors.push(`Failed to repair ${symlink.name}: ${result.error}`);
            }
          }
        }
      }

      // Check for orphan skill directories (directories without symlinks)
      const skillsDir = getReflySkillsDir();
      if (fs.existsSync(skillsDir)) {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        const symlinkNames = new Set(symlinks.map((s) => s.name));

        for (const entry of entries) {
          if (entry.isDirectory() && entry.name !== 'base') {
            if (!symlinkNames.has(entry.name)) {
              orphans += 1;
              warnings.push(`Orphan directory (no symlink): ${path.join(skillsDir, entry.name)}`);

              if (options.prune && !options.dryRun) {
                // Create symlink for orphan directory
                const result = createSkillSymlink(entry.name);
                if (result.success) {
                  repaired += 1;
                }
              }
            }
          }
        }
      }

      // Check for symlinks pointing to non-existent directories
      for (const symlink of symlinks) {
        if (!symlink.isValid && options.prune && !options.dryRun) {
          removeSkillSymlink(symlink.name);
        }
      }

      const summary: SyncSummary = {
        scanned: symlinks.length,
        valid,
        invalid,
        repaired,
        orphans,
        warnings: warnings.length,
      };

      ok('skill.sync', {
        dryRun: Boolean(options.dryRun),
        summary,
        symlinks: symlinks.map((s) => ({
          name: s.name,
          claudePath: s.claudePath,
          target: s.target,
          valid: s.isValid,
        })),
        warnings: warnings.length ? warnings : undefined,
        errors: errors.length ? errors : undefined,
      });
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to sync skills',
      );
    }
  });
