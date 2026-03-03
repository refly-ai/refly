/**
 * Unified Billing Service
 * Handles credit calculation and recording for all tool types
 * Includes dynamic billing configuration management with caching
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import type { SyncToolCreditUsageJobData } from '../../credit/credit.dto';
import { CreditService } from '../../credit/credit.service';
import { calculateCredits } from '../utils/billing';
import { calculateCreditsFromRules } from '../utils/billing-calculation';
import type {
  ProcessBillingOptions,
  ProcessBillingResult,
  ProcessComposioBillingOptions,
  ProviderBillingConfig,
} from './billing.dto';
import { getResultId, getResultVersion, getToolCallId } from '../tool-context';
import { runModuleInitWithTimeoutAndRetry } from '@refly/utils';
import { SingleFlightCache } from '../../../utils/cache';
import type { ToolBillingConfig } from '@refly/openapi-schema';
export type { ProcessBillingOptions, ProcessBillingResult } from './billing.dto';

/**
 * Subscription lookup keys that qualify for free tool usage
 */
const FREE_TOOL_LOOKUP_KEYS = [
  'refly_plus_yearly_stable_v3',
  'refly_plus_yearly_test_v3',
  'refly_plus_monthly_stable_v3',
  'refly_plus_monthly_test_v3',
];

/**
 * Toolset keys that are always free (no credit charge)
 */
const FREE_TOOLSET_KEYS = [
  'nano_banana_pro',
  'instagram',
  'facebook',
  'twitter',
  'fish_audio',
  'seedream_image',
];

const PROVIDER_BILLING_CACHE_TTL_MS = 5 * 60 * 1000;
const MICRO_CREDIT_SCALE = 1_000_000;
const ACCUMULATOR_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  private billingCache: SingleFlightCache<Map<string, ToolBillingConfig>>;
  private providerBillingCache: SingleFlightCache<Map<string, ProviderBillingConfig>>;

  // Timeout for initialization operations (30 seconds)
  private readonly INIT_TIMEOUT = 30000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly redis: RedisService,
  ) {
    // Cache billing configs with 5-minute TTL (same as inventory cache)
    this.billingCache = new SingleFlightCache(this.loadAllBillingConfigs.bind(this), {
      ttl: 5 * 60 * 1000,
    });

    this.providerBillingCache = new SingleFlightCache(this.loadProviderBillingConfigs.bind(this), {
      ttl: PROVIDER_BILLING_CACHE_TTL_MS,
    });
  }

  /**
   * Initialize on module startup
   * Loads all billing configs into cache
   */
  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      async () => {
        this.logger.log('Initializing Billing Service with dynamic configs...');
        try {
          const billingMap = await this.loadAllBillingConfigs();
          this.billingCache.set(billingMap);
          this.logger.log(`Billing initialized with ${billingMap.size} dynamic configurations`);
          const providerMap = await this.loadProviderBillingConfigs();
          this.providerBillingCache.set(providerMap);
          this.logger.log(`Provider billing initialized with ${providerMap.size} configurations`);
        } catch (error) {
          this.logger.error(`Failed to initialize billing configs: ${error}`);
          throw error;
        }
      },
      {
        logger: this.logger,
        label: 'BillingService.onModuleInit',
        timeoutMs: this.INIT_TIMEOUT,
      },
    );
  }

  /**
   * Load all billing configurations from database
   *
   * Only loads enabled configurations to minimize memory footprint.
   * Configurations are stored in a Map with key format: "inventoryKey:methodName"
   *
   * @returns Map of billing configurations
   * @private
   */
  private async loadAllBillingConfigs(): Promise<Map<string, ToolBillingConfig>> {
    const billingMap = new Map<string, ToolBillingConfig>();

    const records = await this.prisma.toolBilling.findMany({
      where: { enabled: true },
      select: {
        inventoryKey: true,
        methodName: true,
        billingRules: true,
        tokenPricing: true,
      },
    });

    for (const record of records) {
      const key = `${record.inventoryKey}:${record.methodName}`;

      // Parse JSON fields and construct config
      const config: ToolBillingConfig = {
        inventoryKey: record.inventoryKey,
        methodName: record.methodName,
        enabled: true,
        rules: record.billingRules as unknown as ToolBillingConfig['rules'],
        tokenPricing: record.tokenPricing as unknown as ToolBillingConfig['tokenPricing'],
      };

      billingMap.set(key, config);
    }

    this.logger.debug(`Loaded ${billingMap.size} tool billing configurations from database`);
    return billingMap;
  }

  /**
   * Get billing configuration for a tool method
   *
   * Performs O(1) lookup in cached map.
   *
   * @param inventoryKey - Inventory key (e.g., 'nano_banana_pro')
   * @param methodName - Method name (e.g., 'generate')
   * @returns Billing configuration or undefined if not found
   */
  async getBillingConfig(
    inventoryKey: string,
    methodName: string,
  ): Promise<ToolBillingConfig | undefined> {
    try {
      const billingMap = await this.billingCache.get();
      const config = billingMap.get(`${inventoryKey}:${methodName}`);

      if (config) {
        this.logger.debug(
          `Found billing config for ${inventoryKey}:${methodName} with ${config.rules.length} rules`,
        );
      } else {
        this.logger.debug(`No billing config found for ${inventoryKey}:${methodName}`);
      }

      return config;
    } catch (error) {
      this.logger.error(
        `Failed to get billing config for ${inventoryKey}:${methodName}: ${error.message}`,
      );
      return undefined; // Triggers fallback to legacy billing
    }
  }

  /**
   * Manually refresh the billing cache
   *
   * Useful for immediately applying configuration changes without waiting for TTL expiry.
   * Should be called after database updates to billing configurations.
   */
  async refreshBillingCache(): Promise<void> {
    this.logger.log('Manually refreshing tool billing cache');
    try {
      const billingMap = await this.loadAllBillingConfigs();
      this.billingCache.set(billingMap);
      this.logger.log(`Cache refreshed with ${billingMap.size} configurations`);
    } catch (error) {
      this.logger.error(`Failed to refresh billing cache: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all cached billing configurations
   *
   * Useful for debugging and admin endpoints.
   *
   * @returns Map of all billing configurations
   */
  async getAllBillingConfigs(): Promise<Map<string, ToolBillingConfig>> {
    return this.billingCache.get();
  }

  async getProviderBillingConfig(providerKey: string): Promise<ProviderBillingConfig | undefined> {
    const configMap = await this.providerBillingCache.get();
    return configMap.get(providerKey);
  }

  /**
   * Calculate the fractional credit cost for a Composio action.
   * Returns a fractional value (e.g., 0.03588 for standard tier).
   * Conversion to micro-credits happens inside processComposioBilling().
   */
  calculateComposioCreditCost(config: ProviderBillingConfig, tier: 'standard' | 'premium'): number {
    const ratePer1K = tier === 'premium' ? config.premiumRatePer1K : config.standardRatePer1K;
    const usdToCreditsRate = Number(process.env.USD_TO_CREDITS_RATE ?? 120);
    return (ratePer1K / 1000) * usdToCreditsRate * config.margin;
  }

  async processComposioBilling(
    options: ProcessComposioBillingOptions,
  ): Promise<ProcessBillingResult> {
    const {
      uid,
      toolName,
      toolsetKey,
      fractionalCreditCost,
      originalFractionalCost,
      resultId,
      version,
      toolCallId,
      idempotencyKey,
    } = options;

    const microCredits = Math.round(fractionalCreditCost * MICRO_CREDIT_SCALE);
    const originalMicroCredits = Math.round(originalFractionalCost * MICRO_CREDIT_SCALE);

    try {
      let finalMicroCredits = microCredits;

      if (FREE_TOOLSET_KEYS.includes(toolsetKey) && finalMicroCredits > 0) {
        const hasFreeToolAccess = await this.checkFreeToolAccess(uid);
        if (hasFreeToolAccess) {
          finalMicroCredits = 0;
        }
      }

      if (finalMicroCredits <= 0) {
        this.logger.debug(
          `Composio billing skipped (free path) for ${toolsetKey}.${toolName}, uid=${uid}`,
        );
        return {
          success: true,
          discountedPrice: 0,
          originalPrice: originalMicroCredits / MICRO_CREDIT_SCALE,
          flushedCredits: 0,
        };
      }

      const effectiveIdempotencyKey =
        idempotencyKey ||
        [
          toolCallId || getToolCallId(),
          resultId || getResultId(),
          version ?? getResultVersion(),
          toolsetKey,
          toolName,
        ]
          .filter((part) => part !== undefined && part !== null && part !== '')
          .join(':');
      const normalizedIdempotencyKey =
        effectiveIdempotencyKey || `${uid}:${toolsetKey}:${toolName}:${Date.now()}`;

      const { flushCredits, remainderMicroCredits, replayed } = await this.accumulateAndFlush({
        uid,
        microCredits: finalMicroCredits,
        idempotencyKey: normalizedIdempotencyKey,
      });

      if (replayed) {
        this.logger.debug(
          `Composio billing replay detected for idempotencyKey=${normalizedIdempotencyKey}`,
        );
        return {
          success: true,
          discountedPrice: 0,
          originalPrice: originalMicroCredits / MICRO_CREDIT_SCALE,
          flushedCredits: 0,
        };
      }

      if (flushCredits > 0) {
        const jobData: SyncToolCreditUsageJobData = {
          uid,
          discountedPrice: flushCredits,
          originalPrice: flushCredits,
          timestamp: new Date(),
          resultId: resultId ?? getResultId() ?? '',
          version: version ?? getResultVersion() ?? 0,
          toolCallId: toolCallId ?? getToolCallId() ?? '',
          toolCallMeta: {
            toolName,
            toolsetKey,
          },
        };
        await this.creditService.syncToolCreditUsage(jobData);
      }

      this.logger.debug(
        `Composio accumulator processed ${toolsetKey}.${toolName}: micro=${finalMicroCredits}, flush=${flushCredits}, remainder=${remainderMicroCredits}`,
      );

      return {
        success: true,
        discountedPrice: finalMicroCredits / MICRO_CREDIT_SCALE,
        originalPrice: originalMicroCredits / MICRO_CREDIT_SCALE,
        flushedCredits: flushCredits,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process composio billing for ${toolsetKey}.${toolName}: ${errorMessage}`,
      );
      return {
        success: false,
        discountedPrice: 0,
        flushedCredits: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Process billing for tool execution
   * Supports both direct credit cost and dynamic calculation via billingConfig
   *
   * @param options - Billing options
   * @returns Billing processing result
   */
  async processBilling(options: ProcessBillingOptions): Promise<ProcessBillingResult> {
    const {
      uid,
      toolName,
      toolsetKey,
      discountedPrice,
      originalPrice,
      billingConfig,
      params,
      input,
      output,
      requestSchema,
      responseSchema,
    } = options;

    try {
      // Determine credit cost — default to 0 (not 1) so tools without
      // any billing config are not silently charged 1 credit.
      let finalDiscountedPrice = 0;
      let finalOriginalPrice = 0;
      let resolvedFromDynamicBilling = false;
      let resolvedFromDirectPrice = false;
      let resolvedFromLegacyBilling = false;
      let resolvedFromExplicitNoCharge = false;
      let dynamicBillingFailed = false;

      // Validate direct-price inputs are finite and non-negative
      if (discountedPrice !== undefined) {
        if (!Number.isFinite(discountedPrice) || discountedPrice < 0) {
          return {
            success: false,
            discountedPrice: 0,
            flushedCredits: 0,
            error: `Invalid discountedPrice: ${discountedPrice} (must be finite and >= 0)`,
          };
        }
      }
      if (originalPrice !== undefined) {
        if (!Number.isFinite(originalPrice) || originalPrice < 0) {
          return {
            success: false,
            discountedPrice: 0,
            flushedCredits: 0,
            error: `Invalid originalPrice: ${originalPrice} (must be finite and >= 0)`,
          };
        }
      }

      if (discountedPrice !== undefined) {
        // Direct credit cost provided (Composio scenario)
        // Changed from `discountedPrice > 0` to `!== undefined` so that
        // explicitly passing 0 is treated as "zero cost" rather than falling
        // through to dynamic/legacy billing.
        resolvedFromDirectPrice = true;
        finalDiscountedPrice = discountedPrice;
        finalOriginalPrice = originalPrice ?? discountedPrice;
      } else {
        // Check for explicit no-charge configuration
        if (billingConfig && billingConfig.enabled === false) {
          resolvedFromExplicitNoCharge = true;
        }

        // Try new dynamic billing system first (if schemas provided)
        if (!resolvedFromExplicitNoCharge && requestSchema && responseSchema && (input || output)) {
          try {
            const config = await this.getBillingConfig(toolsetKey, toolName);

            if (config && config.rules.length > 0) {
              this.logger.debug(`Using dynamic billing config for ${toolsetKey}:${toolName}`);
              finalDiscountedPrice = await calculateCreditsFromRules(
                config,
                input || {},
                output || {},
                requestSchema,
                responseSchema,
                this.logger,
              );

              // Ensure minimum 1 credit per tool call when dynamic billing
              // resolves to a positive sub-credit amount. Without this floor,
              // small inputs (e.g., short TTS text) produce micro-credits that
              // never reach the accumulator flush threshold, resulting in no charge.
              if (finalDiscountedPrice > 0 && finalDiscountedPrice < 1) {
                finalDiscountedPrice = 1;
              }

              finalOriginalPrice = finalDiscountedPrice;
              resolvedFromDynamicBilling = true;

              // Skip to free access check and credit recording below
            }
          } catch (error) {
            dynamicBillingFailed = true;
            this.logger.warn(
              `Dynamic billing calculation failed for ${toolsetKey}:${toolName}, ` +
                `falling back to legacy: ${error.message}`,
            );
            // Fall through to legacy billing
          }
        }

        // Legacy billing fallback (if no new config or error occurred)
        if (
          !resolvedFromDynamicBilling &&
          !resolvedFromExplicitNoCharge &&
          billingConfig?.enabled
        ) {
          if (dynamicBillingFailed) {
            this.logger.debug('Falling back to legacy billing after dynamic billing failure');
          }
          this.logger.debug(`Using legacy billing for ${toolsetKey}:${toolName}`);
          finalDiscountedPrice = calculateCredits(billingConfig, params || {});
          finalOriginalPrice = finalDiscountedPrice;
          resolvedFromLegacyBilling = true;
        }
      }

      // Final finiteness guard on computed prices
      if (!Number.isFinite(finalDiscountedPrice)) {
        this.logger.error(
          `Non-finite finalDiscountedPrice (${finalDiscountedPrice}) for ${toolsetKey}:${toolName}, resetting to 0`,
        );
        finalDiscountedPrice = 0;
      }
      if (!Number.isFinite(finalOriginalPrice)) {
        this.logger.error(
          `Non-finite finalOriginalPrice (${finalOriginalPrice}) for ${toolsetKey}:${toolName}, resetting to 0`,
        );
        finalOriginalPrice = 0;
      }

      // Warn when no billing source resolved and this isn't a known-free toolset
      if (
        !resolvedFromDirectPrice &&
        !resolvedFromDynamicBilling &&
        !resolvedFromLegacyBilling &&
        !resolvedFromExplicitNoCharge &&
        !FREE_TOOLSET_KEYS.includes(toolsetKey)
      ) {
        this.logger.warn(
          `No billing source resolved for ${toolsetKey}:${toolName} — charging 0 credits. This may indicate a missing billing configuration.`,
        );
      }

      // Apply toolset-based free access (specific toolsets are one month free)
      let _appliedFreeAccessOverride = false;
      if (FREE_TOOLSET_KEYS.includes(toolsetKey) && finalDiscountedPrice > 0) {
        const hasFreeToolAccess = await this.checkFreeToolAccess(uid);
        if (hasFreeToolAccess) {
          _appliedFreeAccessOverride = true;
          finalDiscountedPrice = 0;
        }
      }

      // Route through unified per-user accumulator for sub-credit precision
      const microCredits = Math.round(finalDiscountedPrice * MICRO_CREDIT_SCALE);

      if (microCredits <= 0) {
        this.logger.debug(
          `Dynamic billing skipped (free/zero) for ${toolsetKey}.${toolName}, uid=${uid}`,
        );
        return {
          success: true,
          discountedPrice: 0,
          originalPrice: finalOriginalPrice,
        };
      }

      const effectiveToolCallId = options.toolCallId ?? getToolCallId() ?? '';
      const idempotencyKey =
        [
          toolsetKey,
          toolName,
          effectiveToolCallId || undefined,
          options.resultId ?? getResultId() ?? undefined,
          options.version ?? getResultVersion() ?? undefined,
        ]
          .filter((part) => part !== undefined && part !== null && part !== '')
          .join(':') || `${uid}:${toolsetKey}:${toolName}:${Date.now()}`;

      const { flushCredits, remainderMicroCredits, replayed } = await this.accumulateAndFlush({
        uid,
        microCredits,
        idempotencyKey,
      });

      if (replayed) {
        this.logger.debug(`Dynamic billing replay detected for idempotencyKey=${idempotencyKey}`);
        return {
          success: true,
          discountedPrice: 0,
          originalPrice: finalOriginalPrice,
          flushedCredits: 0,
        };
      }

      if (flushCredits > 0) {
        const jobData: SyncToolCreditUsageJobData = {
          uid,
          discountedPrice: flushCredits,
          originalPrice: flushCredits,
          timestamp: new Date(),
          resultId: options.resultId ?? getResultId() ?? '',
          version: options.version ?? getResultVersion() ?? 0,
          toolCallId: effectiveToolCallId,
          toolCallMeta: {
            toolName,
            toolsetKey,
          },
        };
        await this.creditService.syncToolCreditUsage(jobData);
      }

      this.logger.debug(
        `Dynamic accumulator processed ${toolsetKey}.${toolName}: micro=${microCredits}, flush=${flushCredits}, remainder=${remainderMicroCredits}`,
      );

      return {
        success: true,
        discountedPrice: finalDiscountedPrice,
        originalPrice: finalOriginalPrice,
        flushedCredits: flushCredits,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process billing for ${toolsetKey}.${toolName}: ${errorMessage}`);

      // Don't fail the request if billing fails
      return {
        success: false,
        discountedPrice: 0,
        flushedCredits: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if user has free tool access based on subscription lookup key and creation date
   *
   * @param uid - User ID
   * @returns true if user has qualifying subscription created within the last month
   */
  private async checkFreeToolAccess(uid: string): Promise<boolean> {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const subscription = await this.prisma.subscription.findFirst({
        where: {
          uid,
          status: 'active',
          lookupKey: { in: FREE_TOOL_LOOKUP_KEYS },
          createdAt: { gt: oneMonthAgo },
          OR: [{ cancelAt: null }, { cancelAt: { gt: new Date() } }],
        },
      });

      return !!subscription;
    } catch (error) {
      this.logger.warn(`Failed to check free tool access for user ${uid}: ${error}`);
      return false;
    }
  }

  private async loadProviderBillingConfigs(): Promise<Map<string, ProviderBillingConfig>> {
    type ProviderBillingRecord = {
      provider_key: string;
      plan: string;
      standard_rate_per_1k: unknown;
      premium_rate_per_1k: unknown;
      margin: unknown;
    };

    const records = await this.prisma.$queryRaw<ProviderBillingRecord[]>`
      SELECT
        provider_key,
        plan,
        standard_rate_per_1k,
        premium_rate_per_1k,
        margin
      FROM tool_provider_billing
      WHERE active = true
    `;

    const configMap = new Map<string, ProviderBillingConfig>();
    for (const record of records) {
      configMap.set(record.provider_key, {
        providerKey: record.provider_key,
        plan: record.plan,
        standardRatePer1K: Number(record.standard_rate_per_1k),
        premiumRatePer1K: Number(record.premium_rate_per_1k),
        margin: Number(record.margin),
      });
    }
    return configMap;
  }

  private async accumulateAndFlush(args: {
    uid: string;
    microCredits: number;
    idempotencyKey: string;
  }): Promise<{ flushCredits: number; remainderMicroCredits: number; replayed: boolean }> {
    const { uid, microCredits, idempotencyKey } = args;
    const accumulatorKey = `credit_accumulator:${uid}`;
    const idempotencySetKey = `credit_accumulator_idempotency:${uid}`;

    try {
      const client = this.redis.getClient();

      // Rehydrate from DB snapshot if Redis key is missing (e.g., after TTL expiry)
      const keyExists = await client.exists(accumulatorKey);
      if (keyExists === 0) {
        await this.rehydrateFromSnapshot(uid);
      }

      const script = `
        if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then
          local existing = tonumber(redis.call('GET', KEYS[1]) or '0')
          return {0, existing, 1}
        end

        local newTotal = redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))

        redis.call('SADD', KEYS[2], ARGV[2])
        redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))

        local scale = tonumber(ARGV[4])
        local flushCredits = math.floor(newTotal / scale)
        if flushCredits > 0 then
          redis.call('DECRBY', KEYS[1], flushCredits * scale)
        end

        local remainder = newTotal - (flushCredits * scale)
        return {flushCredits, remainder, 0}
      `;
      const result = (await client.eval(
        script,
        2,
        accumulatorKey,
        idempotencySetKey,
        String(microCredits),
        idempotencyKey,
        String(ACCUMULATOR_TTL_SECONDS),
        String(MICRO_CREDIT_SCALE),
      )) as [number, number, number];

      return {
        flushCredits: Number(result[0] ?? 0),
        remainderMicroCredits: Number(result[1] ?? 0),
        replayed: Number(result[2] ?? 0) === 1,
      };
    } catch (error) {
      if (!this.shouldUseRedisNonAtomicFallback(error)) {
        throw error;
      }

      // Refuse non-atomic fallback in production to prevent race conditions
      const nodeEnv = process.env.NODE_ENV ?? '';
      if (nodeEnv === 'production' || nodeEnv === 'staging') {
        this.logger.error(
          `Redis EVAL failed in ${nodeEnv} — refusing non-atomic fallback to prevent race conditions. ` +
            `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }

      // Desktop-mode fallback when redis EVAL is not available (e.g. mock/minimal Redis).
      // NOTE: This non-atomic path has a known race condition between the idempotency
      // check and the INCRBY equivalent. Acceptable for local single-user development
      // only — production MUST use the Lua script above for atomic guarantees.
      const idempotencyKeyName = `${idempotencySetKey}:${idempotencyKey}`;
      const alreadyProcessed = await this.redis.existsBoolean(idempotencyKeyName);
      if (alreadyProcessed) {
        const existing = Number((await this.redis.get(accumulatorKey)) || '0');
        return {
          flushCredits: 0,
          remainderMicroCredits: existing,
          replayed: true,
        };
      }

      const existing = Number((await this.redis.get(accumulatorKey)) || '0');
      const newTotal = existing + microCredits;
      await this.redis.setex(accumulatorKey, ACCUMULATOR_TTL_SECONDS, String(newTotal));
      await this.redis.setex(idempotencyKeyName, ACCUMULATOR_TTL_SECONDS, '1');

      const flushCredits = Math.floor(newTotal / MICRO_CREDIT_SCALE);
      const remainderMicroCredits = newTotal - flushCredits * MICRO_CREDIT_SCALE;
      if (flushCredits > 0) {
        await this.redis.setex(
          accumulatorKey,
          ACCUMULATOR_TTL_SECONDS,
          String(remainderMicroCredits),
        );
      }
      return { flushCredits, remainderMicroCredits, replayed: false };
    }
  }

  private shouldUseRedisNonAtomicFallback(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    // Allow local/mock fallback only for unsupported EVAL / missing command scenarios.
    return (
      normalized.includes('unknown command') ||
      (normalized.includes('eval') &&
        normalized.includes('not') &&
        normalized.includes('support')) ||
      (normalized.includes('not implemented') && normalized.includes('eval'))
    );
  }

  /**
   * Periodic checkpoint: sync Redis accumulator remainders to DB for durability.
   * Runs every 10 minutes. On Redis key miss, rehydrates from DB snapshot.
   */
  @Cron('*/10 * * * *')
  async syncAccumulatorSnapshots(): Promise<void> {
    try {
      const client = this.redis.getClient();
      const pattern = 'credit_accumulator:*';
      const keys: string[] = [];

      // Scan for active accumulator keys (exclude idempotency keys)
      let cursor = '0';
      do {
        const [nextCursor, foundKeys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        for (const key of foundKeys) {
          if (!key.includes('idempotency')) {
            keys.push(key);
          }
        }
      } while (cursor !== '0');

      if (keys.length === 0) {
        return;
      }

      for (const key of keys) {
        const uid = key.replace('credit_accumulator:', '');
        const remainder = await client.get(key);

        if (remainder !== null) {
          await this.prisma.creditAccumulatorSnapshot.upsert({
            where: { uid },
            create: {
              uid,
              remainderMicroCredits: BigInt(remainder),
              lastSyncedAt: new Date(),
            },
            update: {
              remainderMicroCredits: BigInt(remainder),
              lastSyncedAt: new Date(),
            },
          });
        }
      }

      this.logger.debug(`Synced ${keys.length} accumulator snapshots to DB`);
    } catch (error) {
      this.logger.warn(`Failed to sync accumulator snapshots: ${error}`);
    }
  }

  /**
   * Rehydrate a user's accumulator from DB snapshot when Redis key is missing.
   * Called during accumulateAndFlush when the Redis key doesn't exist.
   */
  async rehydrateFromSnapshot(uid: string): Promise<number> {
    try {
      const snapshot = await this.prisma.creditAccumulatorSnapshot.findUnique({
        where: { uid },
      });

      if (snapshot && snapshot.remainderMicroCredits > 0) {
        const remainder = Number(snapshot.remainderMicroCredits);
        const accumulatorKey = `credit_accumulator:${uid}`;
        const client = this.redis.getClient();
        await client.set(accumulatorKey, String(remainder), 'EX', ACCUMULATOR_TTL_SECONDS);
        this.logger.debug(`Rehydrated accumulator for uid=${uid} with remainder=${remainder}`);
        return remainder;
      }

      return 0;
    } catch (error) {
      this.logger.warn(`Failed to rehydrate accumulator for uid=${uid}: ${error}`);
      return 0;
    }
  }
}
