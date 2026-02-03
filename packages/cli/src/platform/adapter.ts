/**
 * Platform adapter interface - defines operations for platform-specific skill deployment.
 */

import type { AgentConfig, AgentType } from './registry.js';

/**
 * Result of a skill deployment operation
 */
export interface DeployResult {
  success: boolean;
  agent: AgentType;
  skillName: string;
  /** Path where skill was deployed (symlink or file) */
  deployedPath: string | null;
  /** Source path (canonical skill location) */
  sourcePath: string;
  /** Error message if failed */
  error?: string;
  /** Whether a symlink was created (vs. file copy/generation) */
  isSymlink: boolean;
}

/**
 * Result of a skill removal operation
 */
export interface RemoveResult {
  success: boolean;
  agent: AgentType;
  skillName: string;
  /** Path that was removed */
  removedPath: string | null;
  error?: string;
}

/**
 * Information about a deployed skill
 */
export interface DeployedSkillInfo {
  name: string;
  agent: AgentType;
  /** Path to deployed skill */
  path: string;
  /** Whether it's a valid symlink/file */
  isValid: boolean;
  /** Target path if symlink */
  target?: string;
  /** Whether it's a symlink */
  isSymlink: boolean;
}

/**
 * Platform adapter interface
 * Each adapter handles skill deployment for a specific platform format
 */
export interface PlatformAdapter {
  /**
   * Deploy a skill to this platform
   * @param skillName - Name of the skill
   * @param sourcePath - Canonical path to skill (e.g., ~/.refly/skills/<name>)
   * @param agent - Agent configuration
   * @param options - Deployment options
   */
  deploy(
    skillName: string,
    sourcePath: string,
    agent: AgentConfig,
    options?: {
      force?: boolean;
      projectPath?: string; // For project-level deployment
    },
  ): Promise<DeployResult>;

  /**
   * Remove a skill from this platform
   * @param skillName - Name of the skill
   * @param agent - Agent configuration
   * @param options - Removal options
   */
  remove(
    skillName: string,
    agent: AgentConfig,
    options?: {
      projectPath?: string;
    },
  ): Promise<RemoveResult>;

  /**
   * List all deployed skills for this platform
   * @param agent - Agent configuration
   * @param options - List options
   */
  list(
    agent: AgentConfig,
    options?: {
      projectPath?: string;
    },
  ): Promise<DeployedSkillInfo[]>;

  /**
   * Check if a skill is deployed and valid
   * @param skillName - Name of the skill
   * @param agent - Agent configuration
   * @param options - Check options
   */
  isDeployed(
    skillName: string,
    agent: AgentConfig,
    options?: {
      projectPath?: string;
    },
  ): Promise<{ deployed: boolean; valid: boolean; path?: string }>;
}

/**
 * Multi-platform deployment result
 */
export interface MultiPlatformDeployResult {
  skillName: string;
  sourcePath: string;
  results: Map<AgentType, DeployResult>;
  /** Number of successful deployments */
  successCount: number;
  /** Number of failed deployments */
  failureCount: number;
}

/**
 * Multi-platform removal result
 */
export interface MultiPlatformRemoveResult {
  skillName: string;
  results: Map<AgentType, RemoveResult>;
  successCount: number;
  failureCount: number;
}
