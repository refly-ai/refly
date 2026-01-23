/**
 * refly skill sync - Sync local skill registry with filesystem
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { readRegistry, writeRegistry } from '../../skill/registry.js';
import { listSkillDirectories, getSkillRelativePath } from '../../skill/storage.js';
import { loadSkill } from '../../skill/loader.js';
import { SkillEntry } from '../../skill/types.js';

interface SyncSummary {
  scanned: number;
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  pruned: number;
  warnings: number;
}

export const skillSyncCommand = new Command('sync')
  .description('Sync local skill registry with filesystem')
  .option('--dry-run', 'Show changes without writing registry')
  .option('--prune', 'Remove registry entries that have no local files')
  .action(async (options) => {
    try {
      const registry = readRegistry();
      const now = new Date().toISOString();

      const existingLocal = new Map(
        registry.skills.filter((s) => s.source === 'local').map((s) => [s.name, s]),
      );
      const nonLocal = registry.skills.filter((s) => s.source !== 'local');

      const skillDirs = listSkillDirectories();
      const warnings: string[] = [];
      const errors: string[] = [];

      const updatedLocal: SkillEntry[] = [];
      let added = 0;
      let updated = 0;
      let unchanged = 0;
      let skipped = 0;

      for (const dirName of skillDirs) {
        try {
          const loaded = loadSkill(dirName);
          const frontmatter = loaded.frontmatter;

          if (frontmatter.name !== dirName) {
            warnings.push(`Skill name mismatch: dir=${dirName}, frontmatter=${frontmatter.name}`);
            skipped += 1;
            continue;
          }

          const prev = existingLocal.get(frontmatter.name);
          const entry: SkillEntry = {
            name: frontmatter.name,
            description: frontmatter.description,
            workflowId: frontmatter.workflowId,
            triggers: frontmatter.triggers,
            path: getSkillRelativePath(frontmatter.name),
            createdAt: prev?.createdAt ?? now,
            updatedAt: now,
            source: 'local',
            tags: frontmatter.tags,
            author: frontmatter.author,
            version: frontmatter.version,
          };

          updatedLocal.push(entry);

          if (!prev) {
            added += 1;
          } else if (
            prev.description !== entry.description ||
            prev.workflowId !== entry.workflowId ||
            JSON.stringify(prev.triggers) !== JSON.stringify(entry.triggers) ||
            JSON.stringify(prev.tags ?? []) !== JSON.stringify(entry.tags ?? []) ||
            prev.author !== entry.author ||
            prev.version !== entry.version ||
            prev.path !== entry.path
          ) {
            updated += 1;
          } else {
            unchanged += 1;
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'Failed to load skill');
          skipped += 1;
        }
      }

      const updatedNames = new Set(updatedLocal.map((s) => s.name));
      const orphans = Array.from(existingLocal.keys()).filter((name) => !updatedNames.has(name));

      const pruned = options.prune ? orphans.length : 0;
      if (!options.prune && orphans.length > 0) {
        warnings.push(`Orphan registry entries (no local files): ${orphans.join(', ')}`);
      }

      const preservedLocal = options.prune
        ? []
        : registry.skills.filter((s) => s.source === 'local' && orphans.includes(s.name));

      const finalSkills: SkillEntry[] = [...nonLocal, ...updatedLocal, ...preservedLocal];

      if (!options.dryRun) {
        writeRegistry({
          ...registry,
          skills: finalSkills,
          updatedAt: now,
        });
      }

      const summary: SyncSummary = {
        scanned: skillDirs.length,
        added,
        updated,
        unchanged,
        skipped,
        pruned,
        warnings: warnings.length,
      };

      ok('skill.sync', {
        dryRun: Boolean(options.dryRun),
        summary,
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
