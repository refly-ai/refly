/**
 * PTC Config
 * Manages PTC (Programmatic Tool Calling) mode configuration and permission checks.
 * Supports global toggle, user-level allowlist, and toolset-level allow/block lists.
 */

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

  return {
    mode,
    debugMode,
    userAllowlist,
    toolsetAllowlist,
    toolsetBlocklist,
    sequential,
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
  // Step 1: Check user-level permission
  if (!isPtcEnabledForUser(user, config)) {
    return false;
  }

  // Step 2: Check all toolsets are allowed
  return toolsetKeys.every((key) => isToolsetAllowed(key, config));
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
