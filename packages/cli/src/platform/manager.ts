/**
 * Platform manager - orchestrates skill deployment across all enabled platforms.
 *
 * This module provides high-level functions for:
 * - Detecting installed agents
 * - Deploying skills to all enabled platforms
 * - Removing skills from all platforms
 * - Syncing skills across platforms
 */

import * as fs from 'node:fs';
import type { AgentConfig, AgentType } from './registry.js';
import { agents, getSkillMdAgents, getConversionAgents } from './registry.js';
import type {
  PlatformAdapter,
  DeployResult,
  MultiPlatformDeployResult,
  MultiPlatformRemoveResult,
  DeployedSkillInfo,
} from './adapter.js';
import { symlinkAdapter } from './symlink-adapter.js';
import { formatConverterAdapter } from './format-converter.js';
import { getReflyDomainSkillDir, getReflyBaseSkillDir } from '../config/paths.js';
import { logger } from '../utils/logger.js';

/**
 * Get the appropriate adapter for an agent
 */
function getAdapter(agent: AgentConfig): PlatformAdapter {
  switch (agent.format) {
    case 'skill-md':
      return symlinkAdapter;
    case 'cursor-mdc':
    case 'rules-md':
      return formatConverterAdapter;
    default:
      // For unknown formats, try symlink adapter
      return symlinkAdapter;
  }
}

/**
 * Detect all installed agents on the system
 */
export async function detectInstalledAgents(): Promise<AgentConfig[]> {
  const installed: AgentConfig[] = [];

  for (const agent of Object.values(agents)) {
    try {
      const isInstalled = await agent.detectInstalled();
      if (isInstalled) {
        installed.push(agent);
      }
    } catch (err) {
      logger.debug(`Error detecting ${agent.displayName}: ${(err as Error).message}`);
    }
  }

  return installed;
}

/**
 * Get agents that should receive skill deployments
 * (installed agents, excluding those with unknown format unless forced)
 */
export async function getDeployableAgents(options?: { includeUnknown?: boolean }): Promise<
  AgentConfig[]
> {
  const installed = await detectInstalledAgents();

  if (options?.includeUnknown) {
    return installed;
  }

  return installed.filter((agent) => agent.format !== 'unknown');
}

/**
 * Deploy a skill to all enabled platforms
 */
export async function deploySkillToAllPlatforms(
  skillName: string,
  options?: {
    force?: boolean;
    projectPath?: string;
    agents?: AgentType[];
  },
): Promise<MultiPlatformDeployResult> {
  // Determine source path
  const sourcePath =
    skillName === 'refly' ? getReflyBaseSkillDir() : getReflyDomainSkillDir(skillName);

  const result: MultiPlatformDeployResult = {
    skillName,
    sourcePath,
    results: new Map(),
    successCount: 0,
    failureCount: 0,
  };

  // Check source exists
  if (!fs.existsSync(sourcePath)) {
    logger.error(`Source skill directory does not exist: ${sourcePath}`);
    return result;
  }

  // Get target agents
  let targetAgents: AgentConfig[];
  if (options?.agents && options.agents.length > 0) {
    targetAgents = options.agents.map((name) => agents[name]).filter(Boolean);
  } else {
    targetAgents = await getDeployableAgents();
  }

  // Deploy to each agent
  for (const agent of targetAgents) {
    const adapter = getAdapter(agent);
    try {
      const deployResult = await adapter.deploy(skillName, sourcePath, agent, {
        force: options?.force,
        projectPath: options?.projectPath,
      });
      result.results.set(agent.name, deployResult);
      if (deployResult.success) {
        result.successCount++;
      } else {
        result.failureCount++;
      }
    } catch (err) {
      result.results.set(agent.name, {
        success: false,
        agent: agent.name,
        skillName,
        deployedPath: null,
        sourcePath,
        isSymlink: false,
        error: (err as Error).message,
      });
      result.failureCount++;
    }
  }

  return result;
}

/**
 * Remove a skill from all platforms
 */
export async function removeSkillFromAllPlatforms(
  skillName: string,
  options?: {
    projectPath?: string;
    agents?: AgentType[];
  },
): Promise<MultiPlatformRemoveResult> {
  const result: MultiPlatformRemoveResult = {
    skillName,
    results: new Map(),
    successCount: 0,
    failureCount: 0,
  };

  // Get target agents
  let targetAgents: AgentConfig[];
  if (options?.agents && options.agents.length > 0) {
    targetAgents = options.agents.map((name) => agents[name]).filter(Boolean);
  } else {
    targetAgents = await getDeployableAgents();
  }

  // Remove from each agent
  for (const agent of targetAgents) {
    const adapter = getAdapter(agent);
    try {
      const removeResult = await adapter.remove(skillName, agent, {
        projectPath: options?.projectPath,
      });
      result.results.set(agent.name, removeResult);
      if (removeResult.success) {
        result.successCount++;
      } else {
        result.failureCount++;
      }
    } catch (err) {
      result.results.set(agent.name, {
        success: false,
        agent: agent.name,
        skillName,
        removedPath: null,
        error: (err as Error).message,
      });
      result.failureCount++;
    }
  }

  return result;
}

/**
 * List all deployed skills across all platforms
 */
export async function listAllDeployedSkills(options?: {
  projectPath?: string;
  agents?: AgentType[];
}): Promise<Map<AgentType, DeployedSkillInfo[]>> {
  const result = new Map<AgentType, DeployedSkillInfo[]>();

  // Get target agents
  let targetAgents: AgentConfig[];
  if (options?.agents && options.agents.length > 0) {
    targetAgents = options.agents.map((name) => agents[name]).filter(Boolean);
  } else {
    targetAgents = await getDeployableAgents();
  }

  // List from each agent
  for (const agent of targetAgents) {
    const adapter = getAdapter(agent);
    try {
      const skills = await adapter.list(agent, {
        projectPath: options?.projectPath,
      });
      result.set(agent.name, skills);
    } catch (err) {
      logger.debug(`Error listing skills for ${agent.displayName}: ${(err as Error).message}`);
      result.set(agent.name, []);
    }
  }

  return result;
}

/**
 * Sync a skill to all platforms (repair/recreate deployments)
 */
export async function syncSkillToAllPlatforms(
  skillName: string,
  options?: {
    projectPath?: string;
    agents?: AgentType[];
    dryRun?: boolean;
  },
): Promise<{
  needsSync: Map<AgentType, { deployed: boolean; valid: boolean; path?: string }>;
  synced: Map<AgentType, DeployResult>;
}> {
  const needsSync = new Map<AgentType, { deployed: boolean; valid: boolean; path?: string }>();
  const synced = new Map<AgentType, DeployResult>();

  // Determine source path
  const sourcePath =
    skillName === 'refly' ? getReflyBaseSkillDir() : getReflyDomainSkillDir(skillName);

  // Get target agents
  let targetAgents: AgentConfig[];
  if (options?.agents && options.agents.length > 0) {
    targetAgents = options.agents.map((name) => agents[name]).filter(Boolean);
  } else {
    targetAgents = await getDeployableAgents();
  }

  // Check status for each agent
  for (const agent of targetAgents) {
    const adapter = getAdapter(agent);
    try {
      const status = await adapter.isDeployed(skillName, agent, {
        projectPath: options?.projectPath,
      });
      needsSync.set(agent.name, status);

      // If not deployed or invalid, sync it
      if ((!status.deployed || !status.valid) && !options?.dryRun) {
        const deployResult = await adapter.deploy(skillName, sourcePath, agent, {
          force: true, // Force to repair
          projectPath: options?.projectPath,
        });
        synced.set(agent.name, deployResult);
      }
    } catch (err) {
      logger.debug(
        `Error checking/syncing ${skillName} for ${agent.displayName}: ${(err as Error).message}`,
      );
    }
  }

  return { needsSync, synced };
}

/**
 * Get summary of platform support
 */
export function getPlatformSummary(): {
  skillMdAgents: AgentConfig[];
  conversionAgents: AgentConfig[];
  totalAgents: number;
} {
  return {
    skillMdAgents: getSkillMdAgents(),
    conversionAgents: getConversionAgents(),
    totalAgents: Object.keys(agents).length,
  };
}

/**
 * Export individual adapters for direct use
 */
export { symlinkAdapter, formatConverterAdapter };
