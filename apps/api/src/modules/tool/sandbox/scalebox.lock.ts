/**
 * Scalebox Lock Configuration and Calculation
 * Provides lock configuration types, validation, and automatic derivation
 */

/**
 * Lock configuration for Redis-based distributed locks
 */
export interface ScaleboxLockConfig {
  /** Redis lock TTL in seconds (auto-expire if holder crashes) */
  ttlSec: number;
  /** Lock acquisition timeout in milliseconds (max wait time) */
  timeoutMs: number;
  /** Lock polling interval in milliseconds (retry frequency) */
  pollIntervalMs: number;
}

/**
 * Base configuration parameters for lock calculation
 * All lock TTL and timeout values are derived from these base parameters
 */
export interface ScaleboxLockBaseConfig {
  /** Maximum code execution timeout in seconds (base parameter) */
  runCodeTimeout: number;
  /** Buffer time for file operations (listFiles × 2 + registerFiles) in seconds */
  fileOperationBuffer: number;
  /** Buffer time for mount/unmount operations in seconds */
  mountUnmountBuffer: number;
  /** Queue depth: how many requests can wait for lock */
  queueDepth: number;
  /** Lock polling interval in milliseconds */
  pollIntervalMs: number;
}

/**
 * Calculated lock configuration result
 */
export interface ScaleboxCalculatedLockConfig {
  /** Runtime runCode timeout in milliseconds (passed to SDK) */
  runCodeTimeoutMs: number;
  /** Sandbox lock configuration */
  sandbox: ScaleboxLockConfig;
  /** Execute lock configuration */
  execute: ScaleboxLockConfig;
}

/**
 * Calculate lock configuration from base runCodeTimeout
 *
 * Calculation formulas:
 * - sandboxLockTTL = runCodeTimeout + fileOperationBuffer
 * - executeLockTTL = sandboxLockTTL + mountUnmountBuffer
 * - sandboxLockTimeoutMs = queueDepth × sandboxLockTTL × 1000
 * - executeLockTimeoutMs = queueDepth × executeLockTTL × 1000
 *
 * Hierarchy: executeLockTTL > sandboxLockTTL > runCodeTimeout
 *
 * @param baseConfig - Base configuration parameters
 * @returns Calculated lock configuration with all derived values
 */
export function calculateLockConfig(
  baseConfig: ScaleboxLockBaseConfig,
): ScaleboxCalculatedLockConfig {
  const { runCodeTimeout, fileOperationBuffer, mountUnmountBuffer, queueDepth, pollIntervalMs } =
    baseConfig;

  // Calculate Sandbox Lock TTL (covers runCode + file operations)
  const sandboxLockTTL = runCodeTimeout + fileOperationBuffer;

  // Calculate Execute Lock TTL (covers sandboxLock + mount/unmount)
  const executeLockTTL = sandboxLockTTL + mountUnmountBuffer;

  // Calculate lock acquisition timeouts (support queuing)
  const sandboxLockTimeoutMs = queueDepth * sandboxLockTTL * 1000;
  const executeLockTimeoutMs = queueDepth * executeLockTTL * 1000;

  return {
    runCodeTimeoutMs: runCodeTimeout * 1000,
    sandbox: {
      ttlSec: sandboxLockTTL,
      timeoutMs: sandboxLockTimeoutMs,
      pollIntervalMs,
    },
    execute: {
      ttlSec: executeLockTTL,
      timeoutMs: executeLockTimeoutMs,
      pollIntervalMs,
    },
  };
}

/**
 * Default base lock configuration
 */
export const DEFAULT_LOCK_BASE_CONFIG: ScaleboxLockBaseConfig = {
  /** Maximum code execution timeout in seconds */
  runCodeTimeout: 5 * 60, // 300 seconds = 5 minutes
  /** Buffer time for file operations (listFiles × 2 + registerFiles) */
  fileOperationBuffer: 30, // 30 seconds
  /** Buffer time for mount/unmount operations */
  mountUnmountBuffer: 30, // 30 seconds
  /** Queue depth: allow 2 requests to wait for lock */
  queueDepth: 2,
  /** Lock polling interval in milliseconds */
  pollIntervalMs: 100,
};

/**
 * Pre-calculated default lock configuration
 * Derived from DEFAULT_LOCK_BASE_CONFIG
 */
export const DEFAULT_LOCK_CONFIG = calculateLockConfig(DEFAULT_LOCK_BASE_CONFIG);
