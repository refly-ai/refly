/**
 * Platform registry - Agent definitions with verified paths for multi-platform skill deployment.
 *
 * Supported platforms (11 total):
 * - SKILL.md format (7 agents): Claude Code, Codex, Antigravity, GitHub Copilot, Windsurf, OpenCode, Moltbot
 * - Different formats (3 agents): Cursor (.mdc), Continue (rules), Trae (rules)
 * - Unverified (1 agent): Qoder
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

/**
 * Supported agent types
 */
export type AgentType =
  // SKILL.md format (symlink compatible)
  | 'claude-code'
  | 'codex'
  | 'antigravity'
  | 'github-copilot'
  | 'windsurf'
  | 'opencode'
  | 'moltbot'
  // Different formats (require conversion)
  | 'cursor'
  | 'continue'
  | 'trae'
  // Unverified
  | 'qoder';

/**
 * Skill format types
 */
export type SkillFormat = 'skill-md' | 'cursor-mdc' | 'rules-md' | 'unknown';

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent identifier */
  name: AgentType;
  /** Human-readable display name */
  displayName: string;
  /** Skill format used by this agent */
  format: SkillFormat;
  /** Project-level skills directory (relative to project root) */
  skillsDir: string | null;
  /** Global skills directory (absolute path) */
  globalSkillsDir: string | null;
  /** Detection function to check if agent is installed */
  detectInstalled: () => Promise<boolean>;
  /** File extension for skills (default: none for directories, or .mdc/.md for files) */
  fileExtension?: string;
  /** Whether skills are stored as files (true) or directories (false, default) */
  skillsAsFiles?: boolean;
}

const home = homedir();

/**
 * Check if a path exists (sync for simplicity)
 */
function pathExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Agent registry with verified paths from official documentation
 */
export const agents: Record<AgentType, AgentConfig> = {
  // === SKILL.md Format (Symlink Compatible) ===

  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    format: 'skill-md',
    skillsDir: '.claude/skills',
    globalSkillsDir: path.join(home, '.claude', 'skills'),
    detectInstalled: async () => pathExists(path.join(home, '.claude')),
  },

  codex: {
    name: 'codex',
    displayName: 'Codex',
    format: 'skill-md',
    skillsDir: '.codex/skills',
    globalSkillsDir: process.env.CODEX_HOME
      ? path.join(process.env.CODEX_HOME, 'skills')
      : path.join(home, '.codex', 'skills'),
    detectInstalled: async () => pathExists(path.join(home, '.codex')),
  },

  antigravity: {
    name: 'antigravity',
    displayName: 'Antigravity',
    format: 'skill-md',
    skillsDir: '.agent/skills',
    globalSkillsDir: path.join(home, '.gemini', 'antigravity', 'skills'),
    detectInstalled: async () => pathExists(path.join(home, '.gemini', 'antigravity')),
  },

  'github-copilot': {
    name: 'github-copilot',
    displayName: 'GitHub Copilot',
    format: 'skill-md',
    skillsDir: '.github/skills',
    globalSkillsDir: path.join(home, '.copilot', 'skills'),
    detectInstalled: async () => pathExists(path.join(home, '.copilot')),
  },

  windsurf: {
    name: 'windsurf',
    displayName: 'Windsurf',
    format: 'skill-md',
    skillsDir: '.windsurf/skills',
    globalSkillsDir: path.join(home, '.codeium', 'windsurf', 'skills'),
    detectInstalled: async () => pathExists(path.join(home, '.codeium', 'windsurf')),
  },

  opencode: {
    name: 'opencode',
    displayName: 'OpenCode',
    format: 'skill-md',
    skillsDir: '.opencode/skill',
    globalSkillsDir: path.join(home, '.config', 'opencode', 'skill'),
    detectInstalled: async () => pathExists(path.join(home, '.config', 'opencode')),
  },

  moltbot: {
    name: 'moltbot',
    displayName: 'Moltbot',
    format: 'skill-md',
    skillsDir: 'skills', // <workspace>/skills
    globalSkillsDir: path.join(home, '.clawdbot', 'skills'), // Note: .clawdbot not .moltbot
    detectInstalled: async () => pathExists(path.join(home, '.clawdbot')),
  },

  // === Different Formats (Require Conversion) ===

  cursor: {
    name: 'cursor',
    displayName: 'Cursor',
    format: 'cursor-mdc',
    skillsDir: '.cursor/rules',
    globalSkillsDir: null, // Cursor has no global rules directory
    detectInstalled: async () => pathExists(path.join(home, '.cursor')),
    fileExtension: '.mdc',
    skillsAsFiles: true,
  },

  continue: {
    name: 'continue',
    displayName: 'Continue',
    format: 'rules-md',
    skillsDir: '.continue/rules',
    globalSkillsDir: path.join(home, '.continue', 'rules'),
    detectInstalled: async () => pathExists(path.join(home, '.continue')),
    fileExtension: '.md',
    skillsAsFiles: true,
  },

  trae: {
    name: 'trae',
    displayName: 'Trae',
    format: 'rules-md',
    skillsDir: '.trae/rules',
    globalSkillsDir: path.join(home, '.trae', 'rules'),
    detectInstalled: async () => pathExists(path.join(home, '.trae')),
    fileExtension: '.md',
    skillsAsFiles: true,
  },

  // === Unverified ===

  qoder: {
    name: 'qoder',
    displayName: 'Qoder',
    format: 'unknown',
    skillsDir: '.qoder/skills', // Assumed, not verified
    globalSkillsDir: path.join(home, '.qoder', 'skills'),
    detectInstalled: async () => pathExists(path.join(home, '.qoder')),
  },
};

/**
 * Get all agents using SKILL.md format (symlink compatible)
 */
export function getSkillMdAgents(): AgentConfig[] {
  return Object.values(agents).filter((a) => a.format === 'skill-md');
}

/**
 * Get all agents requiring format conversion
 */
export function getConversionAgents(): AgentConfig[] {
  return Object.values(agents).filter((a) => a.format === 'cursor-mdc' || a.format === 'rules-md');
}

/**
 * Get agent by name
 */
export function getAgent(name: AgentType): AgentConfig | undefined {
  return agents[name];
}

/**
 * Get all agent names
 */
export function getAllAgentNames(): AgentType[] {
  return Object.keys(agents) as AgentType[];
}

/**
 * Check if agent type is valid
 */
export function isValidAgentType(name: string): name is AgentType {
  return name in agents;
}
