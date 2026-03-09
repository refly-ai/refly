/**
 * PTC Config
 * Manages PTC (Programmatic Tool Calling) mode configuration and permission checks.
 * Supports global toggle, user-level allowlist, and toolset-level allow/block lists.
 */

import { createHash } from 'node:crypto';

import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { User } from '@refly/openapi-schema';

const logger = new Logger('PtcConfig');

/**
 * PTC mode enum
 */
export enum PtcMode {
  /** Global disable - PTC is disabled for all users */
  OFF = 'off',
  /** Global enable - PTC is enabled for all users */
  ON = 'on',
  /** Partial mode - PTC is enabled only for users in allowlist */
  PARTIAL = 'partial',
}

/**
 * PTC debug mode enum
 *
 * Controls title-based filtering when debugging PTC. Only applies when the base
 * PTC permission check (PTC_MODE + PTC_USER_ALLOWLIST) already permits PTC.
 */
export enum PtcDebugMode {
  /**
   * Opt-in: PTC is disabled by default; enable per-node by adding "useptc" to its title.
   * Equivalent to the legacy PTC_DEBUG=true behaviour.
   */
  OPT_IN = 'opt-in',
  /**
   * Opt-out: PTC is enabled by default; disable per-node by adding "nonptc" to its title.
   */
  OPT_OUT = 'opt-out',
}

/**
 * PTC configuration interface
 */
export interface PtcConfig {
  mode: PtcMode;
  userAllowlist: Set<string>;
  toolsetAllowlist: Set<string> | null;
  toolsetBlocklist: Set<string>;
  /** null = debug filtering disabled */
  debugMode: PtcDebugMode | null;
  /** Force all tool calls to execute sequentially (disables concurrent execution in prompt) */
  sequential: boolean;
  /** Percentage of otherwise-eligible users for whom PTC is enabled (0-100, default 100) */
  rolloutPercent: number;
  /** Salt for deterministic per-user bucketing; change to re-bucket users */
  rolloutSalt: string;
}

/**
 * Get PTC configuration from ConfigService
 *
 * @param configService - NestJS ConfigService
 * @returns Parsed PTC configuration
 */
export function getPtcConfig(configService: ConfigService): PtcConfig {
  const mode = parsePtcMode(configService.get<string>('ptc.mode'));
  const debugMode = parsePtcDebugMode(configService.get<string>('ptc.debug'));
  const userAllowlist = parseCommaSeparatedList(configService.get<string>('ptc.userAllowlist'));
  const toolsetAllowlist = parseOptionalCommaSeparatedList(
    configService.get<string>('ptc.toolsetAllowlist'),
  );
  const toolsetBlocklist = parseCommaSeparatedList(
    configService.get<string>('ptc.toolsetBlocklist'),
  );

  const sequential = configService.get<boolean>('ptc.sequential') ?? false;

  const rolloutPercent = Math.min(
    100,
    Math.max(0, configService.get<number>('ptc.rolloutPercent') ?? 100),
  );
  const rolloutSalt = configService.get<string>('ptc.rolloutSalt') || 'ptc-rollout';

  return {
    mode,
    debugMode,
    userAllowlist,
    toolsetAllowlist,
    toolsetBlocklist,
    sequential,
    rolloutPercent,
    rolloutSalt,
  };
}

/**
 * Check if PTC is enabled for a specific user.
 *
 * @param user - The user to check
 * @param config - PTC configuration
 * @returns true if PTC is enabled for the user
 */
export function isPtcEnabledForUser(user: User, config: PtcConfig): boolean {
  switch (config.mode) {
    case PtcMode.OFF:
      return false;

    case PtcMode.ON:
      return true;

    case PtcMode.PARTIAL:
      return config.userAllowlist.has(user.uid);

    default:
      logger.warn(`Unknown PTC mode: ${config.mode}, defaulting to off`);
      return false;
  }
}

/**
 * Compute a deterministic rollout bucket (0-99) for a user.
 * Uses SHA-256 of `uid + salt` so the assignment is stable across requests.
 */
function computeRolloutBucket(uid: string, salt: string): number {
  const hash = createHash('sha256')
    .update(uid + salt)
    .digest();
  return hash.readUInt32BE(0) % 100;
}

/**
 * Check if a user falls within the rollout percentage.
 * Users are bucketed deterministically so their assignment is stable.
 *
 * @param uid - The user ID
 * @param config - PTC configuration
 * @returns true if the user is within the rollout percentage
 */
export function isPtcEnabledForRollout(uid: string, config: PtcConfig): boolean {
  if (config.rolloutPercent >= 100) return true;
  if (config.rolloutPercent <= 0) return false;
  return computeRolloutBucket(uid, config.rolloutSalt) < config.rolloutPercent;
}

/**
 * Check if PTC is enabled for a specific user and multiple toolsets.
 * All toolsets must be allowed for the user.
 *
 * @param user - The user to check
 * @param toolsetKeys - Array of toolset keys to check
 * @param config - PTC configuration
 * @returns true if PTC is enabled for the user and ALL toolsets
 */
export function isPtcEnabledForToolsets(
  user: User,
  toolsetKeys: string[],
  config: PtcConfig,
): boolean {
  // Step 1: Check user-level permission (mode + allowlist)
  if (!isPtcEnabledForUser(user, config)) {
    return false;
  }

  // Step 2: Check all toolsets are allowed
  if (!toolsetKeys.every((key) => isToolsetAllowed(key, config))) {
    return false;
  }

  // Step 3: Apply rollout gate — evaluated after mode/toolset eligibility
  return isPtcEnabledForRollout(user.uid, config);
}

/**
 * Check if a specific toolset is allowed by PTC configuration.
 * Toolset blocklist has higher priority than allowlist.
 *
 * @param toolsetKey - The toolset key to check
 * @param config - PTC configuration
 * @returns true if the toolset is allowed
 */
export function isToolsetAllowed(toolsetKey: string, config: PtcConfig): boolean {
  // Blocklist has highest priority
  if (config.toolsetBlocklist.has(toolsetKey)) {
    return false;
  }

  // If allowlist is configured, only allow toolsets in the list
  if (config.toolsetAllowlist !== null) {
    return config.toolsetAllowlist.has(toolsetKey);
  }

  // No allowlist means all toolsets are allowed (if not blocked)
  return true;
}

/**
 * Parse PTC debug mode from string
 *
 * Accepts "opt-in", "opt-out", or the legacy "true" (treated as opt-in).
 * Returns null when unset or empty.
 *
 * @param value - Debug env var value
 * @returns Parsed PtcDebugMode or null
 */
function parsePtcDebugMode(value?: string): PtcDebugMode | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  // Legacy boolean support: PTC_DEBUG=true → opt-in
  if (normalized === 'true') {
    return PtcDebugMode.OPT_IN;
  }

  if (Object.values(PtcDebugMode).includes(normalized as PtcDebugMode)) {
    return normalized as PtcDebugMode;
  }

  logger.warn(
    `Invalid PTC_DEBUG value: ${value}, valid values are: ${Object.values(PtcDebugMode).join(', ')}. Disabling debug mode.`,
  );
  return null;
}

/**
 * Parse PTC mode from string
 *
 * @param value - Mode string
 * @returns Parsed PTC mode (defaults to OFF)
 */
function parsePtcMode(value?: string): PtcMode {
  if (!value) {
    return PtcMode.OFF;
  }

  const normalizedValue = value.toLowerCase();
  if (Object.values(PtcMode).includes(normalizedValue as PtcMode)) {
    return normalizedValue as PtcMode;
  }

  logger.warn(
    `Invalid PTC_MODE value: ${value}, valid values are: ${Object.values(PtcMode).join(', ')}. Defaulting to OFF.`,
  );
  return PtcMode.OFF;
}

/**
 * Parse comma-separated list into a Set
 *
 * @param value - Comma-separated string
 * @returns Set of trimmed values
 */
function parseCommaSeparatedList(value?: string): Set<string> {
  if (!value?.trim()) {
    return new Set();
  }

  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

/**
 * Parse optional comma-separated list into a Set or null
 *
 * @param value - Comma-separated string
 * @returns Set of trimmed values, or null if not configured
 */
function parseOptionalCommaSeparatedList(value?: string): Set<string> | null {
  if (!value?.trim()) {
    return null;
  }

  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}
