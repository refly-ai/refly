/**
 * Unified Billing Service
 * Handles credit calculation and recording for all tool types
 * Includes dynamic billing configuration management with caching
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { SyncToolCreditUsageJobData } from '../../credit/credit.dto';
import { CreditService } from '../../credit/credit.service';
import { calculateCredits } from '../utils/billing';
import { calculateCreditsFromRules } from '../utils/billing-calculation';
import type { ProcessBillingOptions, ProcessBillingResult } from './billing.dto';
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

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  private billingCache: SingleFlightCache<Map<string, ToolBillingConfig>>;

  // Timeout for initialization operations (30 seconds)
  private readonly INIT_TIMEOUT = 30000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
  ) {
    // Cache billing configs with 5-minute TTL (same as inventory cache)
    this.billingCache = new SingleFlightCache(this.loadAllBillingConfigs.bind(this), {
      ttl: 5 * 60 * 1000,
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
          this.logger.log(`Billing initialized with ${billingMap.size} dynamic configurations`);
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
      // Determine credit cost
      let finalDiscountedPrice = 1;
      let finalOriginalPrice = 1;

      if (discountedPrice !== undefined && discountedPrice > 0) {
        // Direct credit cost provided (Composio scenario)
        finalDiscountedPrice = discountedPrice;
        finalOriginalPrice = originalPrice;
      } else {
        // Try new dynamic billing system first (if schemas provided)
        if (requestSchema && responseSchema && (input || output)) {
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
              finalOriginalPrice = finalDiscountedPrice;

              // Skip to free access check and credit recording below
            }
          } catch (error) {
            this.logger.warn(
              `Dynamic billing calculation failed for ${toolsetKey}:${toolName}, ` +
                `falling back to legacy: ${error.message}`,
            );
            // Fall through to legacy billing
          }
        }

        // Legacy billing fallback (if no new config or error occurred)
        if (finalDiscountedPrice === 1 && billingConfig?.enabled) {
          this.logger.debug(`Using legacy billing for ${toolsetKey}:${toolName}`);
          finalDiscountedPrice = calculateCredits(billingConfig, params || {});
          finalOriginalPrice = finalDiscountedPrice; // No discount in dynamic-tooling scenario
        }
      }

      // Apply toolset-based free access (specific toolsets are one month free)
      if (FREE_TOOLSET_KEYS.includes(toolsetKey) && finalDiscountedPrice > 0) {
        const hasFreeToolAccess = await this.checkFreeToolAccess(uid);
        finalDiscountedPrice = hasFreeToolAccess ? 0 : finalDiscountedPrice;
      }

      // Record credit usage
      const jobData: SyncToolCreditUsageJobData = {
        uid,
        discountedPrice: finalDiscountedPrice,
        originalPrice: finalOriginalPrice,
        timestamp: new Date(),
        resultId: options.resultId ?? getResultId(),
        version: options.version ?? getResultVersion(),
        toolCallId: getToolCallId(),
        toolCallMeta: {
          toolName,
          toolsetKey,
        },
      };

      await this.creditService.syncToolCreditUsage(jobData);

      return {
        success: true,
        discountedPrice: finalDiscountedPrice,
        originalPrice: finalOriginalPrice,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process billing for ${toolsetKey}.${toolName}: ${errorMessage}`);

      // Don't fail the request if billing fails
      return {
        success: false,
        discountedPrice: 0,
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
}
