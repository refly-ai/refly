import { Injectable, Logger, Inject, forwardRef, OnModuleInit, Optional } from '@nestjs/common';
import { User, WorkflowVariable } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { CreditService } from '../credit/credit.service';
import { NotificationService } from '../notification/notification.service';
import { genVoucherID, genVoucherInvitationID, genInviteCode, getYYYYMMDD } from '@refly/utils';
import {
  VoucherDTO,
  VoucherTriggerResult,
  DailyTriggerCheckResult,
  CreateVoucherInput,
  UpdateVoucherInput,
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
  VoucherStatus,
  InvitationStatus,
  INVITER_REWARD_CREDITS,
  AnalyticsEvents,
  VoucherSource,
  VoucherSourceType,
} from './voucher.constants';
import { generateVoucherEmail, calculateDiscountValues } from './voucher-email-templates';
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
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
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
        removeOnFail: true,
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
   * Handle create voucher from source event - main entry point
   * Checks daily limit, scores template, generates voucher
   *
   * @param user - User creating the voucher
   * @param canvasData - Pre-fetched canvas data with nodes
   * @param variables - Workflow variables
   * @param source - Voucher source
   * @param sourceId - Source entity ID
   * @param description - Template description
   * @returns VoucherTriggerResult or null if limit reached
   */
  async handleCreateVoucherFromSource(
    user: User,
    _canvasData: any,
    _variables: WorkflowVariable[],
    source: VoucherSourceType,
    sourceId?: string,
    _description?: string,
  ): Promise<VoucherTriggerResult | null> {
    const lockKey = `voucher-create-lock:${user.uid}:${source}`;
    const releaseLock = await this.redis.waitLock(lockKey, { ttlSeconds: 10 });
    if (!releaseLock) {
      this.logger.warn(
        `Failed to acquire voucher create lock for user ${user.uid}, source ${source}`,
      );
      return null;
    }

    try {
      this.logger.log(
        `Handling create voucher for user ${user.uid}, source ${source}, source id ${sourceId}`,
      );

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

      // 2. Calculate discount percentage from config
      const discountPercent = this.configService.get('voucher.defaultDiscountPercent') ?? 80;
      const llmScore = 100; // Default score when not using LLM scoring

      const VOUCHER_EXPIRATION_MINUTES = this.configService.get('voucher.expirationMinutes');

      // 3. Generate voucher
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + VOUCHER_EXPIRATION_MINUTES);

      let voucher: VoucherDTO;

      // Check if there is an existing unused and unexpired voucher to reuse
      const unusedVoucher = await this.prisma.voucher.findFirst({
        where: {
          uid: user.uid,
          status: VoucherStatus.UNUSED,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (unusedVoucher) {
        // Update existing unused voucher with latest values
        voucher = await this.updateVoucher(unusedVoucher.voucherId, {
          discountPercent,
          llmScore,
          sourceId,
          status: VoucherStatus.UNUSED,
        });
        this.logger.log(
          `Reusing existing unused voucher for user ${user.uid}: ${voucher.voucherId} (source: ${source})`,
        );
      } else if (source === VoucherSource.RUN_WORKFLOW) {
        // Ensure only one voucher per day for run_workflow source
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const existingVoucherToday = await this.prisma.voucher.findFirst({
          where: {
            uid: user.uid,
            source: VoucherSource.RUN_WORKFLOW,
            createdAt: {
              gte: startOfDay,
            },
          },
        });

        if (existingVoucherToday) {
          if (existingVoucherToday.status !== VoucherStatus.USED) {
            // This case is actually covered by the unusedVoucher check above,
            // but we keep it for clarity and in case unusedVoucher check was slightly different
            voucher = await this.updateVoucher(existingVoucherToday.voucherId, {
              discountPercent,
              llmScore,
              sourceId,
              status: VoucherStatus.UNUSED,
            });
            this.logger.log(
              `Updated existing workflow voucher for user ${user.uid}: ${voucher.voucherId}`,
            );
          } else {
            // Already used today, just return it
            voucher = this.toVoucherDTO(existingVoucherToday);
            this.logger.log(
              `Workflow voucher for user ${user.uid} already used today: ${voucher.voucherId}`,
            );
          }
        } else {
          // Create new voucher
          voucher = await this.createVoucher({
            uid: user.uid,
            discountPercent,
            llmScore,
            source,
            sourceId: sourceId,
            expiresAt,
          });
        }
      } else {
        // For other sources, always create new voucher if no unused one exists
        voucher = await this.createVoucher({
          uid: user.uid,
          discountPercent,
          llmScore,
          source,
          sourceId: sourceId,
          expiresAt,
        });
      }

      // 4. Record popup trigger
      await this.recordPopupTrigger(user.uid, sourceId, voucher.voucherId);

      // 5. Track analytics event
      this.trackEvent(AnalyticsEvents.VOUCHER_POPUP_DISPLAY, {
        uid: user.uid,
        voucherId: voucher.voucherId,
        discountPercent,
        llmScore,
      });

      this.logger.log(
        `Voucher generated for user ${user.uid}: ${voucher.voucherId} (${discountPercent}% off)`,
      );

      // 6. Send email notification (async, don't wait)
      this.sendVoucherEmail(user.uid, discountPercent).catch((err) => {
        this.logger.error(`Failed to send voucher email for user ${user.uid}: ${err.stack}`);
      });

      return {
        voucher,
        score: llmScore,
        feedback: 'Thank you for using Refly!',
      };
    } catch (error) {
      this.logger.error(`Failed to handle voucher creation for user ${user.uid}: ${error.stack}`);
      throw error;
    } finally {
      await releaseLock();
    }
  }

  /**
   * Send voucher notification email to user
   */
  private async sendVoucherEmail(uid: string, discountPercent: number): Promise<void> {
    // Get user info including locale
    const userPo = await this.prisma.user.findUnique({
      where: { uid },
      select: { email: true, nickname: true, name: true, uiLocale: true },
    });

    if (!userPo?.email) {
      this.logger.warn(`Cannot send voucher email: user ${uid} has no email`);
      return;
    }

    // Calculate discount values
    const { discountValue, discountedPrice } = calculateDiscountValues(discountPercent);

    // Generate email content based on user's locale
    const userName = userPo.nickname || userPo.name || 'Refly User';
    const expirationMinutes = this.configService.get('voucher.expirationMinutes');
    // Convert minutes to days for email display (round up)
    const expirationDays = Math.max(1, Math.ceil(expirationMinutes / (60 * 24)));
    const { subject, html } = generateVoucherEmail(
      {
        userName,
        discountPercent,
        discountValue,
        discountedPrice,
        expirationDays,
      },
      userPo.uiLocale || undefined,
    );

    // Send email
    await this.notificationService.sendEmail({
      to: userPo.email,
      subject,
      html,
    });

    this.logger.log(`Voucher email sent to user ${uid} (${userPo.email})`);
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
            restrictions: {
              first_time_transaction: true, // Only for users who haven't made a purchase
            },
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
   * Update an existing voucher
   */
  async updateVoucher(voucherId: string, input: UpdateVoucherInput): Promise<VoucherDTO> {
    const existing = await this.prisma.voucher.findUnique({
      where: { voucherId },
    });

    if (!existing) {
      throw new Error(`Voucher ${voucherId} not found`);
    }

    let stripePromoCodeId = existing.stripePromoCodeId;

    // If discount percent changed, create a new Stripe promotion code
    if (
      this.stripeClient &&
      input.discountPercent !== undefined &&
      input.discountPercent !== existing.discountPercent
    ) {
      try {
        const stripeCoupon = await this.prisma.stripeCoupon.findFirst({
          where: {
            discountPercent: input.discountPercent,
            isActive: true,
          },
        });

        if (stripeCoupon) {
          const expiresAt = input.expiresAt ?? existing.expiresAt;
          const promoCode = await this.stripeClient.promotionCodes.create({
            coupon: stripeCoupon.stripeCouponId,
            max_redemptions: 1,
            restrictions: {
              first_time_transaction: true,
            },
            expires_at: Math.floor(expiresAt.getTime() / 1000),
            metadata: {
              voucherId,
              uid: existing.uid,
              source: existing.source,
            },
          });

          stripePromoCodeId = promoCode.id;
          this.logger.log(
            `Created new Stripe promotion code ${promoCode.id} for updated voucher ${voucherId} (${input.discountPercent}% off)`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to create Stripe promotion code for updated voucher ${voucherId}: ${error.message}`,
        );
      }
    }

    const updated = await this.prisma.voucher.update({
      where: { pk: existing.pk },
      data: {
        discountPercent: input.discountPercent ?? existing.discountPercent,
        llmScore: input.llmScore ?? existing.llmScore,
        expiresAt: input.expiresAt ?? existing.expiresAt,
        sourceId: input.sourceId ?? existing.sourceId,
        status: input.status ?? existing.status,
        stripePromoCodeId,
        // Reset usage fields if status is set back to unused
        usedAt: input.status === VoucherStatus.UNUSED ? null : undefined,
        subscriptionId: input.status === VoucherStatus.UNUSED ? null : undefined,
        updatedAt: new Date(),
      },
    });

    return this.toVoucherDTO(updated);
  }

  /**
   * Get user's available (unused, not expired) vouchers
   * New logic: Returns both owned vouchers AND claimed vouchers (via invitation)
   * bestVoucher prioritizes vouchers with stripePromoCodeId (actually usable in Stripe)
   */
  async getAvailableVouchers(uid: string): Promise<VoucherAvailableResult> {
    const now = new Date();

    // 0. Check if user has prior Stripe transactions (for first_time_transaction vouchers)
    let userHasPriorTransactions = false;
    if (this.stripeClient) {
      const userPo = await this.prisma.user.findUnique({
        where: { uid },
        select: { customerId: true },
      });

      if (userPo?.customerId) {
        try {
          const payments = await this.stripeClient.paymentIntents.list({
            customer: userPo.customerId,
            limit: 1,
          });
          userHasPriorTransactions = payments.data.some((p) => p.status === 'succeeded');
        } catch (error) {
          this.logger.warn(
            `Failed to check Stripe payment history for user ${uid}: ${error.message}`,
          );
        }
      }
    }

    // 1. Get vouchers owned by the user
    const ownedVouchers = await this.prisma.voucher.findMany({
      where: {
        uid,
        status: VoucherStatus.UNUSED,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: [{ discountPercent: 'desc' }, { createdAt: 'desc' }],
    });

    // 2. Get vouchers claimed via invitation
    const claimedInvitations = await this.prisma.voucherInvitation.findMany({
      where: {
        inviteeUid: uid,
        status: InvitationStatus.CLAIMED,
      },
    });

    const claimedVoucherIds = claimedInvitations.map((inv) => inv.voucherId);

    let claimedVouchers: any[] = [];
    if (claimedVoucherIds.length > 0) {
      claimedVouchers = await this.prisma.voucher.findMany({
        where: {
          voucherId: { in: claimedVoucherIds },
          status: VoucherStatus.UNUSED,
          expiresAt: { gt: now },
        },
        orderBy: [{ discountPercent: 'desc' }, { createdAt: 'desc' }],
      });
    }

    // 3. Merge and deduplicate (in case of overlap)
    const voucherMap = new Map<string, any>();
    for (const v of ownedVouchers) {
      voucherMap.set(v.voucherId, v);
    }
    for (const v of claimedVouchers) {
      if (!voucherMap.has(v.voucherId)) {
        voucherMap.set(v.voucherId, v);
      }
    }

    const allVouchers = Array.from(voucherMap.values());
    const voucherDTOs = allVouchers.map((v) => this.toVoucherDTO(v));

    // Separate vouchers with and without stripePromoCodeId
    // If user has prior transactions, vouchers with stripePromoCodeId are not usable
    // (they have first_time_transaction restriction)
    const vouchersWithPromo = voucherDTOs.filter((v) => v.stripePromoCodeId);
    const vouchersWithoutPromo = voucherDTOs.filter((v) => !v.stripePromoCodeId);

    // If user has prior transactions, mark promo vouchers as not usable for bestVoucher selection
    const usableVouchersWithPromo = userHasPriorTransactions ? [] : vouchersWithPromo;

    // Sort each group by discountPercent desc, then createdAt desc
    const sortByDiscount = (a: VoucherDTO, b: VoucherDTO) => {
      if (b.discountPercent !== a.discountPercent) {
        return b.discountPercent - a.discountPercent;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    vouchersWithPromo.sort(sortByDiscount);
    vouchersWithoutPromo.sort(sortByDiscount);
    usableVouchersWithPromo.sort(sortByDiscount);

    // Combine: vouchers with promo code first, then without
    const sortedVouchers = [...vouchersWithPromo, ...vouchersWithoutPromo];

    // bestVoucher: prefer usable voucher with stripePromoCodeId
    // If user has prior transactions, only vouchers without promo code are usable
    const bestVoucher = usableVouchersWithPromo[0] || vouchersWithoutPromo[0] || undefined;

    if (userHasPriorTransactions && vouchersWithPromo.length > 0) {
      this.logger.log(
        `User ${uid} has prior transactions, ${vouchersWithPromo.length} vouchers with promo code are not usable`,
      );
    }

    return {
      hasAvailableVoucher: sortedVouchers.length > 0,
      vouchers: sortedVouchers,
      bestVoucher,
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
   * New logic: Allow owner OR claimant (via invitation) to use the voucher
   */
  async validateVoucher(uid: string, voucherId: string): Promise<VoucherValidateResult> {
    const voucher = await this.prisma.voucher.findFirst({
      where: { voucherId },
    });

    if (!voucher) {
      return { valid: false, reason: 'Voucher not found' };
    }

    // Check permission: owner OR claimant
    const isOwner = voucher.uid === uid;
    const isClaimant = await this.prisma.voucherInvitation.findFirst({
      where: {
        voucherId,
        inviteeUid: uid,
        status: InvitationStatus.CLAIMED,
      },
    });

    if (!isOwner && !isClaimant) {
      return { valid: false, reason: 'You do not have permission to use this voucher' };
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

    // Check if voucher has Stripe promotion code with first_time_transaction restriction
    // If so, verify user has no prior Stripe transactions
    if (voucher.stripePromoCodeId && this.stripeClient) {
      const userPo = await this.prisma.user.findUnique({
        where: { uid },
        select: { customerId: true },
      });

      if (userPo?.customerId) {
        try {
          // Check if customer has any prior successful payments
          const payments = await this.stripeClient.paymentIntents.list({
            customer: userPo.customerId,
            limit: 1,
          });

          if (payments.data.some((p) => p.status === 'succeeded')) {
            this.logger.log(
              `User ${uid} has prior Stripe transactions, voucher ${voucherId} not applicable`,
            );
            return {
              valid: false,
              voucher: this.toVoucherDTO(voucher),
              reason: 'This coupon is only available for first-time purchases',
            };
          }
        } catch (error) {
          this.logger.warn(
            `Failed to check Stripe payment history for user ${uid}: ${error.message}`,
          );
          // Continue without blocking - let Stripe handle the restriction
        }
      }
    }

    return {
      valid: true,
      voucher: this.toVoucherDTO(voucher),
    };
  }

  /**
   * Mark a voucher as used
   * New logic: Grant reward to voucher OWNER when someone else (invitee) successfully pays
   * Scenario: A creates voucher → A shares to B (Plus) → B shares to C → C pays → A gets reward
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

    // Grant reward to voucher OWNER if the payer is NOT the owner
    // Find the subscription to get the payer's uid
    const subscription = await this.prisma.subscription.findUnique({
      where: { subscriptionId: input.subscriptionId },
      select: { uid: true },
    });

    if (subscription) {
      const payerUid = subscription.uid;
      const voucherOwnerUid = voucher.uid;
      const isOwner = voucherOwnerUid === payerUid;

      if (!isOwner) {
        // Payer is not the voucher owner
        // Find any claimed invitation for this voucher to use for idempotency
        const invitation = await this.prisma.voucherInvitation.findFirst({
          where: {
            voucherId: input.voucherId,
            status: InvitationStatus.CLAIMED,
          },
        });

        if (invitation) {
          // Grant reward to voucher OWNER (not invitation.inviterUid)
          // This ensures A gets reward even if B (Plus user) shared to C
          await this.grantInviterReward(voucherOwnerUid, invitation.invitationId);
          this.logger.log(
            `Voucher owner reward granted to ${voucherOwnerUid} for voucher ${input.voucherId} (payer: ${payerUid})`,
          );
        }
      }
    }

    return this.toVoucherDTO(updatedVoucher);
  }

  /**
   * Create a sharing invitation for a voucher
   * Users can share if they are the owner OR if they claimed the voucher via invitation
   */
  async createInvitation(uid: string, voucherId: string): Promise<CreateInvitationResult> {
    // Get the voucher (without uid filter - we'll check permission separately)
    const voucher = await this.prisma.voucher.findFirst({
      where: { voucherId },
    });

    if (!voucher) {
      throw new Error('Voucher not found');
    }

    // Check permission: owner OR claimant (same logic as validateVoucher)
    const isOwner = voucher.uid === uid;
    const isClaimant = await this.prisma.voucherInvitation.findFirst({
      where: {
        voucherId,
        inviteeUid: uid,
        status: InvitationStatus.CLAIMED,
      },
    });

    if (!isOwner && !isClaimant) {
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

    this.logger.log(`Invitation created: ${invitationId} with code ${inviteCode}`);

    return {
      invitation: this.toInvitationDTO(invitation),
    };
  }

  /**
   * Verify an invitation code
   * Returns detailed information about the invitation status
   * New logic: Check original voucher status (used/expired) before returning valid
   */
  async verifyInvitation(inviteCode: string): Promise<VerifyInvitationResult> {
    // First try to find any invitation with this code (unclaimed or claimed)
    const invitation = await this.prisma.voucherInvitation.findFirst({
      where: { inviteCode },
    });

    if (!invitation) {
      return {
        valid: false,
        message: 'Invalid or expired invitation',
      };
    }

    // Get inviter's name
    const inviter = await this.prisma.user.findUnique({
      where: { uid: invitation.inviterUid },
      select: { name: true },
    });

    // Find the original voucher that is being shared
    const voucher = await this.prisma.voucher.findFirst({
      where: { voucherId: invitation.voucherId },
    });

    if (!voucher) {
      return {
        valid: false,
        invitation: this.toInvitationDTO(invitation),
        inviterName: inviter?.name || undefined,
        message: 'Voucher not found',
      };
    }

    // Check if voucher has already been used
    if (voucher.status === VoucherStatus.USED) {
      return {
        valid: false,
        invitation: this.toInvitationDTO(invitation),
        voucher: this.toVoucherDTO(voucher),
        inviterName: inviter?.name || undefined,
        message: 'Voucher has already been used',
      };
    }

    // Check if voucher has expired
    if (voucher.status === VoucherStatus.EXPIRED || voucher.expiresAt < new Date()) {
      // Mark as expired if not already
      if (voucher.status !== VoucherStatus.EXPIRED) {
        await this.prisma.voucher.update({
          where: { pk: voucher.pk },
          data: { status: VoucherStatus.EXPIRED, updatedAt: new Date() },
        });
      }
      return {
        valid: false,
        invitation: this.toInvitationDTO(invitation),
        voucher: this.toVoucherDTO({ ...voucher, status: VoucherStatus.EXPIRED }),
        inviterName: inviter?.name || undefined,
        message: 'Voucher has expired',
      };
    }

    // For unclaimed invitations - voucher is valid and can be claimed
    if (invitation.status === InvitationStatus.UNCLAIMED) {
      return {
        valid: true,
        invitation: this.toInvitationDTO(invitation),
        voucher: this.toVoucherDTO(voucher),
        inviterName: inviter?.name || undefined,
      };
    }

    // For claimed invitations - voucher is still valid but this specific invitation is claimed
    // The user who claimed can still use the voucher
    if (invitation.status === InvitationStatus.CLAIMED) {
      return {
        valid: false,
        invitation: this.toInvitationDTO(invitation),
        voucher: this.toVoucherDTO(voucher),
        claimedByUid: invitation.inviteeUid || undefined,
        inviterName: inviter?.name || undefined,
        message: 'Invitation already claimed',
      };
    }

    // Invitation expired or other status
    return {
      valid: false,
      invitation: this.toInvitationDTO(invitation),
      inviterName: inviter?.name || undefined,
      message: 'Invitation is no longer valid',
    };
  }

  /**
   * Claim an invitation - records the claim relationship (no longer creates new voucher)
   * New logic: B claims → gets usage rights to the SAME voucher as A
   * Stripe PromotionCode max_redemptions=1 ensures only one person can use it
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

    // Find the original voucher
    const voucher = await this.prisma.voucher.findFirst({
      where: { voucherId: invitation.voucherId },
    });

    if (!voucher) {
      return {
        success: false,
        message: 'Voucher not found',
      };
    }

    // Check if voucher has already been used
    if (voucher.status === VoucherStatus.USED) {
      return {
        success: false,
        message: 'Voucher has already been used',
      };
    }

    // Check if voucher has expired
    if (voucher.status === VoucherStatus.EXPIRED || voucher.expiresAt < new Date()) {
      return {
        success: false,
        message: 'Voucher has expired',
      };
    }

    // Key change: Don't create new voucher, just update invitation status
    await this.prisma.voucherInvitation.update({
      where: { pk: invitation.pk },
      data: {
        status: InvitationStatus.CLAIMED,
        inviteeUid,
        claimedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Note: Inviter reward (2000 credits) is now granted when invitee successfully pays
    // See useVoucher() method for the reward logic

    // Track analytics
    this.trackEvent(AnalyticsEvents.VOUCHER_CLAIM, {
      inviteeUid,
      inviterUid: invitation.inviterUid,
      inviteCode,
      discountPercent: invitation.discountPercent,
    });

    this.logger.log(
      `Invitation claimed: ${inviteCode} by ${inviteeUid}, inviter: ${invitation.inviterUid} (shared voucher mode)`,
    );

    // Get inviter name
    const inviter = await this.prisma.user.findFirst({
      where: { uid: invitation.inviterUid },
      select: { name: true },
    });

    // Return the ORIGINAL voucher (not a new one)
    return {
      success: true,
      voucher: this.toVoucherDTO(voucher),
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
