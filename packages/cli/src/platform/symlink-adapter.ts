/**
 * Symlink adapter - handles skill deployment for agents using SKILL.md format.
 *
 * For agents that use the standard SKILL.md format (Claude Code, Codex, Antigravity,
 * GitHub Copilot, Windsurf, OpenCode, Moltbot), we create symlinks from the agent's
 * skills directory to the canonical Refly skills location.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { platform } from 'node:os';
import type { AgentConfig } from './registry.js';
import type { PlatformAdapter, DeployResult, RemoveResult, DeployedSkillInfo } from './adapter.js';
import { logger } from '../utils/logger.js';
import { ensureDir } from '../config/paths.js';

/**
 * Create a symlink with platform-specific handling
 * Windows uses junction, Unix uses symlink
 */
async function createSymlinkSafe(
  target: string,
  linkPath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure parent directory exists
    const linkDir = path.dirname(linkPath);
    ensureDir(linkDir);

    // Remove existing symlink or directory if present
    if (fs.existsSync(linkPath)) {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
        logger.debug(`Removed existing symlink: ${linkPath}`);
      } else if (stat.isDirectory()) {
        // If it's a real directory (not a symlink), warn and fail
        return {
          success: false,
          error: `Target path is a directory, not a symlink: ${linkPath}`,
        };
      }
    }

    // Create symlink
    // Windows uses junction for directory symlinks (doesn't require admin)
    const symlinkType = platform() === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(target, linkPath, symlinkType);
    logger.debug(`Created symlink: ${linkPath} -> ${target}`);

    return { success: true };
  } catch (err) {
    // Handle ENOENT for non-existent path (try creating anyway)
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        const symlinkType = platform() === 'win32' ? 'junction' : 'dir';
        fs.symlinkSync(target, linkPath, symlinkType);
        logger.debug(`Created symlink: ${linkPath} -> ${target}`);
        return { success: true };
      } catch (innerErr) {
        return {
          success: false,
          error: (innerErr as Error).message,
        };
      }
    }

    return {
      success: false,
      error: (err as Error).message,
    };
  }
}

/**
 * Symlink adapter for SKILL.md format agents
 */
export class SymlinkAdapter implements PlatformAdapter {
  async deploy(
    skillName: string,
    sourcePath: string,
    agent: AgentConfig,
    options?: { force?: boolean; projectPath?: string },
  ): Promise<DeployResult> {
    const result: DeployResult = {
      success: false,
      agent: agent.name,
      skillName,
      deployedPath: null,
      sourcePath,
      isSymlink: true,
    };

    // Determine target directory (global or project)
    let targetDir: string | null = null;
    if (options?.projectPath && agent.skillsDir) {
      targetDir = path.join(options.projectPath, agent.skillsDir);
    } else {
      targetDir = agent.globalSkillsDir;
    }

    if (!targetDir) {
      result.error = `Agent ${agent.displayName} has no skills directory configured`;
      return result;
    }

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      result.error = `Source skill directory does not exist: ${sourcePath}`;
      return result;
    }

    // Target symlink path
    const linkPath = path.join(targetDir, skillName);
    result.deployedPath = linkPath;

    // Check if already exists
    if (fs.existsSync(linkPath) && !options?.force) {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        const existingTarget = fs.readlinkSync(linkPath);
        const resolvedTarget = path.resolve(path.dirname(linkPath), existingTarget);
        if (resolvedTarget === sourcePath) {
          // Already correctly linked
          result.success = true;
          return result;
        }
      }
      result.error = `Skill already exists at ${linkPath}. Use --force to overwrite.`;
      return result;
    }

    // Create the symlink
    const symlinkResult = await createSymlinkSafe(sourcePath, linkPath);
    if (!symlinkResult.success) {
      result.error = symlinkResult.error;
      return result;
    }

    result.success = true;
    logger.info(`Deployed ${skillName} to ${agent.displayName}: ${linkPath} -> ${sourcePath}`);
    return result;
  }

  async remove(
    skillName: string,
    agent: AgentConfig,
    options?: { projectPath?: string },
  ): Promise<RemoveResult> {
    const result: RemoveResult = {
      success: false,
      agent: agent.name,
      skillName,
      removedPath: null,
    };

    // Determine target directory
    let targetDir: string | null = null;
    if (options?.projectPath && agent.skillsDir) {
      targetDir = path.join(options.projectPath, agent.skillsDir);
    } else {
      targetDir = agent.globalSkillsDir;
    }

    if (!targetDir) {
      result.error = `Agent ${agent.displayName} has no skills directory configured`;
      return result;
    }

    const linkPath = path.join(targetDir, skillName);
    result.removedPath = linkPath;

    try {
      if (!fs.existsSync(linkPath)) {
        // Not an error - skill just doesn't exist
        result.success = true;
        return result;
      }

      const stat = fs.lstatSync(linkPath);
      if (!stat.isSymbolicLink()) {
        result.error = `Path is not a symlink: ${linkPath}`;
        return result;
      }

      fs.unlinkSync(linkPath);
      result.success = true;
      logger.info(`Removed ${skillName} from ${agent.displayName}: ${linkPath}`);
    } catch (err) {
      result.error = (err as Error).message;
    }

    return result;
  }

  async list(agent: AgentConfig, options?: { projectPath?: string }): Promise<DeployedSkillInfo[]> {
    const results: DeployedSkillInfo[] = [];

    // Determine target directory
    let targetDir: string | null = null;
    if (options?.projectPath && agent.skillsDir) {
      targetDir = path.join(options.projectPath, agent.skillsDir);
    } else {
      targetDir = agent.globalSkillsDir;
    }

    if (!targetDir || !fs.existsSync(targetDir)) {
      return results;
    }

    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(targetDir, entry.name);

        try {
          const stat = fs.lstatSync(fullPath);
          if (stat.isSymbolicLink()) {
            const target = fs.readlinkSync(fullPath);
            const resolvedTarget = path.resolve(path.dirname(fullPath), target);
            const isValid = fs.existsSync(resolvedTarget);

            results.push({
              name: entry.name,
              agent: agent.name,
              path: fullPath,
              isValid,
              target: resolvedTarget,
              isSymlink: true,
            });
          } else if (stat.isDirectory()) {
            // Regular directory (not a symlink)
            const skillMdPath = path.join(fullPath, 'SKILL.md');
            results.push({
              name: entry.name,
              agent: agent.name,
              path: fullPath,
              isValid: fs.existsSync(skillMdPath),
              isSymlink: false,
            });
          }
        } catch {
          // Skip entries that can't be read
        }
      }
    } catch {
      // Return empty results if directory can't be read
    }

    return results;
  }

  async isDeployed(
    skillName: string,
    agent: AgentConfig,
    options?: { projectPath?: string },
  ): Promise<{ deployed: boolean; valid: boolean; path?: string }> {
    // Determine target directory
    let targetDir: string | null = null;
    if (options?.projectPath && agent.skillsDir) {
      targetDir = path.join(options.projectPath, agent.skillsDir);
    } else {
      targetDir = agent.globalSkillsDir;
    }

    if (!targetDir) {
      return { deployed: false, valid: false };
    }

    const linkPath = path.join(targetDir, skillName);

    try {
      if (!fs.existsSync(linkPath)) {
        return { deployed: false, valid: false };
      }

      const stat = fs.lstatSync(linkPath);
      if (!stat.isSymbolicLink()) {
        // It's a directory, not a symlink
        const skillMdPath = path.join(linkPath, 'SKILL.md');
        return {
          deployed: true,
          valid: fs.existsSync(skillMdPath),
          path: linkPath,
        };
      }

      const target = fs.readlinkSync(linkPath);
      const resolvedTarget = path.resolve(path.dirname(linkPath), target);
      const isValid = fs.existsSync(resolvedTarget);

      return {
        deployed: true,
        valid: isValid,
        path: linkPath,
      };
    } catch {
      return { deployed: false, valid: false };
    }
  }
}

/**
 * Singleton instance
 */
export const symlinkAdapter = new SymlinkAdapter();
