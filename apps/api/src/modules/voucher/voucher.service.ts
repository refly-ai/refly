import { Injectable, Logger, Inject, forwardRef, OnModuleInit, Optional } from '@nestjs/common';
import { User, WorkflowVariable } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { TemplateScoringService, CanvasDataForScoring } from './template-scoring.service';
import { CreditService } from '../credit/credit.service';
import { genVoucherID, genVoucherInvitationID, genInviteCode, getYYYYMMDD } from '@refly/utils';
import {
  VoucherDTO,
  VoucherTriggerResult,
  DailyTriggerCheckResult,
  CreateVoucherInput,
  VoucherAvailableResult,
  VoucherValidateResult,
  UseVoucherInput,
  VoucherInvitationDTO,
  CreateInvitationResult,
  ClaimInvitationInput,
  ClaimInvitationResult,
  VerifyInvitationResult,
} from './voucher.dto';
import {
  DAILY_POPUP_TRIGGER_LIMIT,
  VOUCHER_EXPIRATION_DAYS,
  VoucherStatus,
  VoucherSource,
  InvitationStatus,
  INVITER_REWARD_CREDITS,
  AnalyticsEvents,
} from './voucher.constants';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_CLEANUP_EXPIRED_VOUCHERS } from '../../utils/const';
import Stripe from 'stripe';
import { InjectStripeClient } from '@golevelup/nestjs-stripe';

@Injectable()
export class VoucherService implements OnModuleInit {
  private readonly logger = new Logger(VoucherService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScoringService: TemplateScoringService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => CreditService))
    private readonly creditService: CreditService,
    @Optional()
    @InjectQueue(QUEUE_CLEANUP_EXPIRED_VOUCHERS)
    private readonly cleanupExpiredVouchersQueue?: Queue,
    @Optional()
    @InjectStripeClient()
    private readonly stripeClient?: Stripe,
  ) {}

  async onModuleInit() {
    if (this.cleanupExpiredVouchersQueue) {
      const initPromise = this.setupCleanupExpiredVouchersJob();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(`Voucher cleanup cronjob timed out after ${this.INIT_TIMEOUT}ms`);
        }, this.INIT_TIMEOUT);
      });

      try {
        await Promise.race([initPromise, timeoutPromise]);
        this.logger.log('Voucher cleanup cronjob scheduled successfully');
      } catch (error) {
        this.logger.error(`Failed to schedule voucher cleanup cronjob: ${error}`);
        // Don't throw - allow service to continue working without the cronjob
      }
    } else {
      this.logger.log('Voucher cleanup queue not available, skipping cronjob setup');
    }
  }

  /**
   * Setup the recurring job to cleanup expired vouchers
   */
  private async setupCleanupExpiredVouchersJob() {
    if (!this.cleanupExpiredVouchersQueue) return;

    // Remove any existing recurring jobs
    const existingJobs = await this.cleanupExpiredVouchersQueue.getJobSchedulers();
    await Promise.all(
      existingJobs.map((job) => this.cleanupExpiredVouchersQueue!.removeJobScheduler(job.id)),
    );

    // Add the new recurring job - runs every 2 hours at minute 30
    await this.cleanupExpiredVouchersQueue.add(
      'cleanup-expired-vouchers',
      {},
      {
        repeat: {
          pattern: '30 */2 * * *', // Run every 2 hours at minute 30
        },
        removeOnComplete: true,
        removeOnFail: false,
        jobId: 'cleanup-expired-vouchers', // Unique job ID to prevent duplicates
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log('Expired vouchers cleanup job scheduled (runs every 2 hours at minute 30)');
  }

  /**
   * Cleanup expired vouchers - marks unused vouchers past expiration as expired
   * Also cleans up unclaimed invitations that are older than 30 days
   */
  async cleanupExpiredVouchers(): Promise<{ vouchersExpired: number; invitationsExpired: number }> {
    const now = new Date();

    // 1. Mark expired vouchers
    const voucherResult = await this.prisma.voucher.updateMany({
      where: {
        status: VoucherStatus.UNUSED,
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: VoucherStatus.EXPIRED,
        updatedAt: now,
      },
    });

    // 2. Mark old unclaimed invitations as expired (30 days old)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const invitationResult = await this.prisma.voucherInvitation.updateMany({
      where: {
        status: InvitationStatus.UNCLAIMED,
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
      data: {
        status: InvitationStatus.EXPIRED,
        updatedAt: now,
      },
    });

    this.logger.log(
      `Cleanup completed: ${voucherResult.count} vouchers expired, ${invitationResult.count} invitations expired`,
    );

    return {
      vouchersExpired: voucherResult.count,
      invitationsExpired: invitationResult.count,
    };
  }

  /**
   * Handle template publish event - main entry point
   * Checks daily limit, scores template, generates voucher
   *
   * @param user - User publishing the template
   * @param canvasData - Pre-fetched canvas data with nodes
   * @param variables - Workflow variables
   * @param templateId - Generated template/app ID
   * @param description - Template description
   * @returns VoucherTriggerResult or null if limit reached
   */
  async handleTemplatePublish(
    user: User,
    canvasData: CanvasDataForScoring,
    variables: WorkflowVariable[],
    templateId: string,
    description?: string,
  ): Promise<VoucherTriggerResult | null> {
    try {
      this.logger.log(`Handling template publish for user ${user.uid}, template ${templateId}`);

      // 1. Check daily trigger limit
      const { canTrigger, currentCount } = await this.checkDailyTriggerLimit(user.uid);

      if (!canTrigger) {
        this.logger.log(
          `Daily trigger limit reached for user ${user.uid}: ${currentCount}/${DAILY_POPUP_TRIGGER_LIMIT}`,
        );

        // Track analytics event
        this.trackEvent(AnalyticsEvents.DAILY_PUBLISH_TRIGGER_LIMIT_REACHED, {
          uid: user.uid,
          currentCount,
          limit: DAILY_POPUP_TRIGGER_LIMIT,
        });

        return null;
      }

      // 2. Score the template using pre-fetched canvas data
      const scoringResult = await this.templateScoringService.scoreTemplateWithCanvasData(
        user,
        canvasData,
        variables,
        description,
      );

      // 3. Calculate discount percentage from score
      const discountPercent = this.templateScoringService.scoreToDiscountPercent(
        scoringResult.score,
      );

      // 4. Generate voucher
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + VOUCHER_EXPIRATION_DAYS);

      const voucher = await this.createVoucher({
        uid: user.uid,
        discountPercent,
        llmScore: scoringResult.score,
        source: VoucherSource.TEMPLATE_PUBLISH,
        sourceId: templateId,
        expiresAt,
      });

      // 5. Record popup trigger
      await this.recordPopupTrigger(user.uid, templateId, voucher.voucherId);

      // 6. Track analytics event
      this.trackEvent(AnalyticsEvents.VOUCHER_POPUP_DISPLAY, {
        uid: user.uid,
        voucherId: voucher.voucherId,
        discountPercent,
        llmScore: scoringResult.score,
      });

      this.logger.log(
        `Voucher generated for user ${user.uid}: ${voucher.voucherId} (${discountPercent}% off)`,
      );

      return {
        voucher,
        score: scoringResult.score,
        feedback: scoringResult.feedback,
      };
    } catch (error) {
      this.logger.error(`Failed to handle template publish for user ${user.uid}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user can trigger popup today
   */
  async checkDailyTriggerLimit(uid: string): Promise<DailyTriggerCheckResult> {
    const today = getYYYYMMDD(new Date());

    const count = await this.prisma.voucherPopupLog.count({
      where: {
        uid,
        popupDate: today,
      },
    });

    return {
      canTrigger: count < DAILY_POPUP_TRIGGER_LIMIT,
      currentCount: count,
      limit: DAILY_POPUP_TRIGGER_LIMIT,
    };
  }

  /**
   * Record a popup trigger event
   */
  async recordPopupTrigger(uid: string, templateId: string, voucherId?: string): Promise<void> {
    const today = getYYYYMMDD(new Date());

    await this.prisma.voucherPopupLog.create({
      data: {
        uid,
        templateId,
        popupDate: today,
        voucherId,
        createdAt: new Date(),
      },
    });
  }

  /**
   * Create a new voucher
   */
  async createVoucher(input: CreateVoucherInput): Promise<VoucherDTO> {
    const voucherId = genVoucherID();
    const now = new Date();

    // 1. Get Stripe coupon ID from database based on discount percent
    let stripePromoCodeId: string | undefined;
    if (this.stripeClient) {
      try {
        const stripeCoupon = await this.prisma.stripeCoupon.findFirst({
          where: {
            discountPercent: input.discountPercent,
            isActive: true,
          },
        });

        if (stripeCoupon) {
          // 2. Create Stripe Promotion Code
          const promoCode = await this.stripeClient.promotionCodes.create({
            coupon: stripeCoupon.stripeCouponId,
            max_redemptions: 1, // One-time use
            expires_at: Math.floor(input.expiresAt.getTime() / 1000), // Convert to Unix timestamp
            metadata: {
              voucherId,
              uid: input.uid,
              source: input.source,
            },
          });

          stripePromoCodeId = promoCode.id;
          this.logger.log(
            `Created Stripe promotion code ${promoCode.id} for voucher ${voucherId} (${input.discountPercent}% off)`,
          );
        } else {
          this.logger.warn(`No active Stripe coupon found for ${input.discountPercent}% discount`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to create Stripe promotion code for voucher ${voucherId}: ${error.message}`,
        );
        // Continue without Stripe promo code - voucher can still be created
      }
    }

    // 3. Create voucher in database
    const voucher = await this.prisma.voucher.create({
      data: {
        voucherId,
        uid: input.uid,
        discountPercent: input.discountPercent,
        status: VoucherStatus.UNUSED,
        source: input.source,
        sourceId: input.sourceId,
        llmScore: input.llmScore,
        expiresAt: input.expiresAt,
        stripePromoCodeId,
        createdAt: now,
        updatedAt: now,
      },
    });

    return this.toVoucherDTO(voucher);
  }

  /**
   * Get user's available (unused, not expired) vouchers
   */
  async getAvailableVouchers(uid: string): Promise<VoucherAvailableResult> {
    const now = new Date();

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        uid,
        status: VoucherStatus.UNUSED,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        discountPercent: 'desc', // Best voucher first
      },
    });

    const voucherDTOs = vouchers.map((v) => this.toVoucherDTO(v));

    return {
      hasAvailableVoucher: voucherDTOs.length > 0,
      vouchers: voucherDTOs,
      bestVoucher: voucherDTOs[0] || undefined,
    };
  }

  /**
   * Get all vouchers for a user (including used/expired)
   */
  async getUserVouchers(uid: string): Promise<VoucherDTO[]> {
    const vouchers = await this.prisma.voucher.findMany({
      where: { uid },
      orderBy: { createdAt: 'desc' },
    });

    return vouchers.map((v) => this.toVoucherDTO(v));
  }

  /**
   * Validate a voucher for use
   */
  async validateVoucher(uid: string, voucherId: string): Promise<VoucherValidateResult> {
    const voucher = await this.prisma.voucher.findFirst({
      where: {
        voucherId,
        uid,
      },
    });

    if (!voucher) {
      return { valid: false, reason: 'Voucher not found' };
    }

    if (voucher.status !== VoucherStatus.UNUSED) {
      return {
        valid: false,
        voucher: this.toVoucherDTO(voucher),
        reason: `Voucher has already been ${voucher.status}`,
      };
    }

    if (voucher.expiresAt < new Date()) {
      // Mark as expired
      await this.prisma.voucher.update({
        where: { pk: voucher.pk },
        data: { status: VoucherStatus.EXPIRED, updatedAt: new Date() },
      });

      return {
        valid: false,
        voucher: this.toVoucherDTO({ ...voucher, status: VoucherStatus.EXPIRED }),
        reason: 'Voucher has expired',
      };
    }

    return {
      valid: true,
      voucher: this.toVoucherDTO(voucher),
    };
  }

  /**
   * Mark a voucher as used
   */
  async useVoucher(input: UseVoucherInput): Promise<VoucherDTO | null> {
    const voucher = await this.prisma.voucher.findFirst({
      where: {
        voucherId: input.voucherId,
        status: VoucherStatus.UNUSED,
      },
    });

    if (!voucher) {
      this.logger.warn(`Voucher not found or already used: ${input.voucherId}`);
      return null;
    }

    const updatedVoucher = await this.prisma.voucher.update({
      where: { pk: voucher.pk },
      data: {
        status: VoucherStatus.USED,
        usedAt: new Date(),
        subscriptionId: input.subscriptionId,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Voucher used: ${input.voucherId}`);

    return this.toVoucherDTO(updatedVoucher);
  }

  /**
   * Create a sharing invitation for a voucher
   */
  async createInvitation(uid: string, voucherId: string): Promise<CreateInvitationResult> {
    // Get the voucher
    const voucher = await this.prisma.voucher.findFirst({
      where: { voucherId, uid },
    });

    if (!voucher) {
      throw new Error('Voucher not found');
    }

    const invitationId = genVoucherInvitationID();
    const inviteCode = genInviteCode();

    const invitation = await this.prisma.voucherInvitation.create({
      data: {
        invitationId,
        inviterUid: uid,
        inviteCode,
        voucherId,
        discountPercent: voucher.discountPercent,
        status: InvitationStatus.UNCLAIMED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Build share URL
    const origin = this.configService.get<string>('origin')?.split(',')[0] || '';
    const shareUrl = `${origin}/invite/${inviteCode}`;

    this.logger.log(`Invitation created: ${invitationId} with code ${inviteCode}`);

    return {
      invitation: this.toInvitationDTO(invitation),
      shareUrl,
      // qrCodeUrl will be generated by frontend or a separate service
    };
  }

  /**
   * Verify an invitation code
   * Returns detailed information about the invitation status
   */
  async verifyInvitation(inviteCode: string): Promise<VerifyInvitationResult> {
    // First try to find unclaimed invitation
    const unclaimedInvitation = await this.prisma.voucherInvitation.findFirst({
      where: {
        inviteCode,
        status: InvitationStatus.UNCLAIMED,
      },
    });

    if (unclaimedInvitation) {
      return {
        valid: true,
        invitation: this.toInvitationDTO(unclaimedInvitation),
      };
    }

    // Check if invitation exists but is already claimed
    const claimedInvitation = await this.prisma.voucherInvitation.findFirst({
      where: {
        inviteCode,
        status: InvitationStatus.CLAIMED,
      },
    });

    if (claimedInvitation) {
      return {
        valid: false,
        invitation: this.toInvitationDTO(claimedInvitation),
        claimedByUid: claimedInvitation.inviteeUid || undefined,
        message: 'Invitation already claimed',
      };
    }

    // Invitation not found or expired
    return {
      valid: false,
      message: 'Invalid or expired invitation',
    };
  }

  /**
   * Claim an invitation - creates a voucher for the invitee
   */
  async claimInvitation(input: ClaimInvitationInput): Promise<ClaimInvitationResult> {
    const { inviteCode, inviteeUid } = input;

    // Find the invitation
    const invitation = await this.prisma.voucherInvitation.findFirst({
      where: {
        inviteCode,
        status: InvitationStatus.UNCLAIMED,
      },
    });

    if (!invitation) {
      return {
        success: false,
        message: 'Invalid or already claimed invitation',
      };
    }

    // Check if invitee is not the inviter
    if (invitation.inviterUid === inviteeUid) {
      return {
        success: false,
        message: 'Cannot claim your own invitation',
      };
    }

    // Create voucher for invitee
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + VOUCHER_EXPIRATION_DAYS);

    const voucher = await this.createVoucher({
      uid: inviteeUid,
      discountPercent: invitation.discountPercent,
      source: VoucherSource.INVITATION_CLAIM,
      sourceId: invitation.invitationId,
      expiresAt,
    });

    // Update invitation status
    await this.prisma.voucherInvitation.update({
      where: { pk: invitation.pk },
      data: {
        status: InvitationStatus.CLAIMED,
        inviteeUid,
        claimedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Grant reward to inviter (2000 credits) - idempotent
    await this.grantInviterReward(invitation.inviterUid, invitation.invitationId);

    // Track analytics
    this.trackEvent(AnalyticsEvents.VOUCHER_CLAIM, {
      inviteeUid,
      inviterUid: invitation.inviterUid,
      inviteCode,
      discountPercent: invitation.discountPercent,
    });

    this.logger.log(
      `Invitation claimed: ${inviteCode} by ${inviteeUid}, inviter: ${invitation.inviterUid}`,
    );

    // Get inviter name
    const inviter = await this.prisma.user.findFirst({
      where: { uid: invitation.inviterUid },
      select: { name: true },
    });

    return {
      success: true,
      voucher,
      inviterName: inviter?.name || undefined,
    };
  }

  /**
   * Grant reward credits to inviter (idempotent)
   */
  private async grantInviterReward(inviterUid: string, invitationId: string): Promise<void> {
    // Check if reward already granted
    const invitation = await this.prisma.voucherInvitation.findFirst({
      where: { invitationId },
    });

    if (!invitation || invitation.rewardGranted) {
      this.logger.log(`Reward already granted for invitation ${invitationId}`);
      return;
    }

    // Mark reward as granted first (idempotent)
    await this.prisma.voucherInvitation.update({
      where: { pk: invitation.pk },
      data: {
        rewardGranted: true,
        updatedAt: new Date(),
      },
    });

    // Grant credits via CreditService
    try {
      await this.creditService.createVoucherInviterRewardRecharge(
        inviterUid,
        invitationId,
        INVITER_REWARD_CREDITS,
      );
      this.logger.log(
        `Inviter reward ${INVITER_REWARD_CREDITS} credits granted to ${inviterUid} for invitation ${invitationId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to grant inviter reward for ${inviterUid}: ${error.message}`);
      // Note: rewardGranted is already true, so this won't retry on failure
      // This is intentional to prevent double-crediting
    }
  }

  /**
   * Convert Prisma voucher to DTO
   */
  private toVoucherDTO(voucher: any): VoucherDTO {
    return {
      voucherId: voucher.voucherId,
      uid: voucher.uid,
      discountPercent: voucher.discountPercent,
      status: voucher.status,
      source: voucher.source,
      sourceId: voucher.sourceId,
      llmScore: voucher.llmScore,
      expiresAt: voucher.expiresAt.toISOString(),
      usedAt: voucher.usedAt?.toISOString(),
      subscriptionId: voucher.subscriptionId,
      stripePromoCodeId: voucher.stripePromoCodeId,
      createdAt: voucher.createdAt.toISOString(),
      updatedAt: voucher.updatedAt.toISOString(),
    };
  }

  /**
   * Convert Prisma invitation to DTO
   */
  private toInvitationDTO(invitation: any): VoucherInvitationDTO {
    return {
      invitationId: invitation.invitationId,
      inviterUid: invitation.inviterUid,
      inviteeUid: invitation.inviteeUid,
      inviteCode: invitation.inviteCode,
      voucherId: invitation.voucherId,
      discountPercent: invitation.discountPercent,
      status: invitation.status,
      claimedAt: invitation.claimedAt?.toISOString(),
      rewardGranted: invitation.rewardGranted,
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString(),
    };
  }

  /**
   * Track analytics event (placeholder - integrate with actual analytics service)
   */
  private trackEvent(eventName: string, properties: Record<string, any>): void {
    this.logger.debug(`Analytics event: ${eventName}`, properties);
    // TODO: Integrate with actual analytics service (e.g., Mixpanel, Amplitude)
  }
}
