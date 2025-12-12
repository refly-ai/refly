/**
 * Unified Billing Service
 * Handles credit calculation and recording for all tool types
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { SyncToolCreditUsageJobData } from '../../credit/credit.dto';
import { CreditService } from '../../credit/credit.service';
import { calculateCredits } from '../utils/billing';
import type { ProcessBillingOptions, ProcessBillingResult } from './billing.dto';
import { getResultId, getResultVersion, getToolCallId } from '../tool-context';
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
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
  ) {}

  /**
   * Process billing for tool execution
   * Supports both direct credit cost and dynamic calculation via billingConfig
   *
   * @param options - Billing options
   * @returns Billing processing result
   */
  async processBilling(options: ProcessBillingOptions): Promise<ProcessBillingResult> {
    const { uid, toolName, toolsetKey, discountedPrice, originalPrice, billingConfig, params } =
      options;

    try {
      // Determine credit cost
      let finalDiscountedPrice = 1;
      let finalOriginalPrice = 1;

      if (discountedPrice !== undefined && discountedPrice > 0) {
        // Direct credit cost provided (Composio scenario)
        finalDiscountedPrice = discountedPrice;
        finalOriginalPrice = originalPrice;
      } else if (billingConfig?.enabled) {
        // Calculate from billing config (dynamic-tooling scenario)
        finalDiscountedPrice = calculateCredits(billingConfig, params || {});
        finalOriginalPrice = finalDiscountedPrice; // No discount in dynamic-tooling scenario
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
