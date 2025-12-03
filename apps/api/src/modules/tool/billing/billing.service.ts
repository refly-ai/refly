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
const FREE_TOOL_LOOKUP_KEYS = ['refly_plus_yearly_stable_v3'];

/**
 * Toolset keys that are always free (no credit charge)
 */
const FREE_TOOLSET_KEYS = [
  'nano_banana_pro',
  'instagram',
  'tiktok',
  'facebook',
  'twitter',
  'fish_audio',
  'fal_image',
  'fal_video',
  'fal_audio',
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

      // Apply toolset-based free access (specific toolsets are always free)
      if (FREE_TOOLSET_KEYS.includes(toolsetKey)) {
        // Apply subscription-based discount
        if (finalDiscountedPrice > 0) {
          const hasFreeToolAccess = await this.checkFreeToolAccess(uid);
          if (hasFreeToolAccess) {
            this.logger.debug(`User ${uid} has free tool access, setting discounted price to 0`);
            finalDiscountedPrice = 0;
          }
        }
      }

      // Record credit usage
      const jobData: SyncToolCreditUsageJobData = {
        uid,
        discountedPrice: finalDiscountedPrice,
        originalPrice: finalOriginalPrice,
        timestamp: new Date(),
        resultId: getResultId(),
        version: getResultVersion(),
        toolCallId: getToolCallId(),
        toolCallMeta: {
          toolName,
          toolsetKey,
        },
      };

      await this.creditService.syncToolCreditUsage(jobData);
      this.logger.debug(`Recorded ${finalDiscountedPrice} credits for ${toolsetKey}.${toolName}`);

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
   * Check if user has free tool access based on their subscription lookup key
   *
   * @param uid - User ID
   * @returns true if user's subscription lookup key matches free tool access criteria
   */
  private async checkFreeToolAccess(uid: string): Promise<boolean> {
    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          uid,
          status: 'active',
          OR: [{ cancelAt: null }, { cancelAt: { gt: new Date() } }],
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          lookupKey: true,
        },
      });

      if (!subscription) {
        return false;
      }

      return FREE_TOOL_LOOKUP_KEYS.includes(subscription.lookupKey);
    } catch (error) {
      this.logger.warn(`Failed to check free tool access for user ${uid}: ${error}`);
      return false;
    }
  }
}
