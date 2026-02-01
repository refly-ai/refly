/**
 * refly skill validate - Validate local skill files
 */

import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { extractSkillMetadata } from '../../skill/loader.js';
import { getSkillsDir, ensureSkillsDir } from '../../config/paths.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ValidationResult {
  path: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const skillValidateCommand = new Command('validate')
  .description('Validate local skill files')
  .argument('[skillPath]', 'Path to skill file or directory (defaults to ~/.refly/skills)')
  .option('--fix', 'Attempt to fix common issues')
  .action(async (skillPath, _options) => {
    try {
      const results: ValidationResult[] = [];

      // Determine path to validate
      let targetPath: string;
      if (skillPath) {
        targetPath = path.resolve(skillPath);
      } else {
        await ensureSkillsDir();
        targetPath = getSkillsDir();
      }

      // Check if path exists
      if (!fs.existsSync(targetPath)) {
        fail(ErrorCodes.NOT_FOUND, `Path not found: ${targetPath}`);
        return;
      }

      const stats = fs.statSync(targetPath);

      if (stats.isFile()) {
        // Validate single file
        const result = validateSkillFile(targetPath);
        results.push(result);
      } else if (stats.isDirectory()) {
        // Validate all .md files in directory (recursively)
        const files = findSkillFiles(targetPath);
        for (const file of files) {
          const result = validateSkillFile(file);
          results.push(result);
        }
      }

      // Summary
      const validCount = results.filter((r) => r.valid).length;
      const invalidCount = results.filter((r) => !r.valid).length;
      const warningCount = results.reduce((sum, r) => sum + r.warnings.length, 0);

      ok('skill.validate', {
        path: targetPath,
        results,
        summary: {
          total: results.length,
          valid: validCount,
          invalid: invalidCount,
          warnings: warningCount,
        },
      });
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to validate skills',
      );
    }
  });

function validateSkillFile(filePath: string): ValidationResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, issues } = extractSkillMetadata(content);

    const errors = issues.map((i) => `${i.path}: ${i.message}`);
    const warnings: string[] = [];

    // Add warnings for optional best practices
    if (frontmatter && !frontmatter.version) {
      warnings.push('version: Consider adding a version field');
    }
    if (frontmatter && !frontmatter.author) {
      warnings.push('author: Consider adding an author field');
    }

    return {
      path: filePath,
      valid: issues.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      path: filePath,
      valid: false,
      errors: [error instanceof Error ? error.message : 'Failed to read file'],
      warnings: [],
    };
  }
}

function findSkillFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden directories
      if (!entry.name.startsWith('.')) {
        findSkillFiles(fullPath, files);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}
