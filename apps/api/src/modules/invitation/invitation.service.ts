import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreditService } from '../credit/credit.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis.service';
import { InvitationCode } from '@refly/openapi-schema';
import { BaseResponse } from '@refly/openapi-schema';
import { User as UserPo } from '@prisma/client';

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  /**
   * generate six uppercase letters and numbers combination invitation code
   */
  private generateInvitationCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * check if the invitation code is unique
   */
  private async isCodeUnique(code: string): Promise<boolean> {
    const existingCode = await this.prisma.invitationCode.findUnique({
      where: { code },
    });
    return !existingCode;
  }

  /**
   * generate a unique invitation code
   */
  private async generateUniqueCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      code = this.generateInvitationCode();
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('Failed to generate unique invitation code after maximum attempts');
      }
    } while (!(await this.isCodeUnique(code)));

    return code;
  }

  /**
   * list the first N invitation codes for a user (by creation time), generate up to N codes if fewer exist
   * N is configurable via auth.invitation.maxCodesPerUser (default: 20)
   */
  async listInvitationCodes(uid: string): Promise<InvitationCode[]> {
    const maxCodesPerUser = this.configService.get<number>('auth.invitation.maxCodesPerUser') ?? 20;

    let invitationCodes = await this.prisma.invitationCode.findMany({
      where: { inviterUid: uid },
      orderBy: { createdAt: 'asc' },
    });

    // If fewer than maxCodesPerUser invitation codes exist, generate new ones until there are maxCodesPerUser
    if (!invitationCodes || invitationCodes.length < maxCodesPerUser) {
      // Use distributed lock to prevent concurrent generation of invitation codes
      const lockKey = `lock:invitation:generate:${uid}`;
      let releaseLock = await this.redis.acquireLock(lockKey, 10);

      if (!releaseLock) {
        // If lock acquisition fails, wait and retry once
        await new Promise((resolve) => setTimeout(resolve, 100));
        releaseLock = await this.redis.acquireLock(lockKey, 10);
        if (!releaseLock) {
          // If still can't acquire lock, just return existing codes
          const existingCodes = await this.prisma.invitationCode.findMany({
            where: { inviterUid: uid },
            orderBy: { createdAt: 'asc' },
            take: maxCodesPerUser,
          });
          return this.formatInvitationCodes(existingCodes);
        }
      }

      try {
        // Re-check the count after acquiring lock to avoid duplicate generation
        invitationCodes = await this.prisma.invitationCode.findMany({
          where: { inviterUid: uid },
          orderBy: { createdAt: 'asc' },
        });

        // Double-check if we still need to generate codes
        if (invitationCodes.length < maxCodesPerUser) {
          const currentCount = invitationCodes.length;
          const neededCount = maxCodesPerUser - currentCount;
          const codes: string[] = [];
          for (let i = 0; i < neededCount; i++) {
            const code = await this.generateUniqueCode();
            codes.push(code);
          }

          // create the new invitation codes in batch
          const newInvitationCodes = await Promise.all(
            codes.map((code) =>
              this.prisma.invitationCode.create({
                data: {
                  code,
                  inviterUid: uid,
                  status: 'pending',
                },
              }),
            ),
          );
          invitationCodes = [...invitationCodes, ...newInvitationCodes];
        }
      } finally {
        await releaseLock();
      }
    }

    // Always return the first maxCodesPerUser codes (by creation time)
    const codesToReturn = invitationCodes.slice(0, maxCodesPerUser);

    return this.formatInvitationCodes(codesToReturn);
  }

  /**
   * format invitation codes for response
   */
  private formatInvitationCodes(codes: any[]): InvitationCode[] {
    return codes.map((code) => ({
      code: code.code,
      inviterUid: code.inviterUid,
      inviteeUid: code.inviteeUid,
      status: code.status,
      createdAt: code.createdAt.toJSON(),
      updatedAt: code.updatedAt.toJSON(),
    }));
  }

  /**
   * check if a user has been invited (check hasBeenInvited field in user preferences)
   */
  async hasBeenInvited(uid: string, userPo?: UserPo): Promise<boolean> {
    const requireInvitationCode =
      this.configService.get('auth.invitation.requireInvitationCode') ?? false;

    // If invitation code is not required, all users are considered invited
    if (!requireInvitationCode) {
      return true;
    }

    // If invitation code is required, check user's hasBeenInvited preference
    const user =
      userPo ??
      (await this.prisma.user.findUnique({
        where: { uid },
        select: { preferences: true },
      }));

    if (!user?.preferences) {
      return false;
    }

    const preferences = JSON.parse(user.preferences);
    return preferences.hasBeenInvited ?? true;
  }

  /**
   * activate invitation code for invitee
   * give both inviter and invitee 500 credits each with 2-week expiration
   */
  async activateInvitationCode(inviteeUid: string, code: string): Promise<BaseResponse> {
    // Check if invitation code exists
    const invitationCode = await this.prisma.invitationCode.findUnique({
      where: { code },
    });

    if (!invitationCode) {
      return { success: false, errMsg: 'settings.account.activateInvitationCodeInvalid' };
    }

    // Check if code is still pending
    if (invitationCode.status !== 'pending') {
      return { success: false, errMsg: 'settings.account.activateInvitationCodeUsed' };
    }

    // Check if invitee has already been invited by anyone
    const existingInvitee = await this.prisma.invitationCode.findFirst({
      where: {
        inviteeUid: inviteeUid,
        status: 'accepted',
      },
    });

    if (existingInvitee) {
      return { success: false, errMsg: 'settings.account.activateInvitationCodeAlreadyInvited' };
    }

    // Check if invitee is trying to use their own invitation code
    if (invitationCode.inviterUid === inviteeUid) {
      return { success: false, errMsg: 'settings.account.activateInvitationCodeOwnCode' };
    }

    // Check if invitee has already been invited by this inviter (unique constraint)
    const existingActivation = await this.prisma.invitationCode.findFirst({
      where: {
        inviterUid: invitationCode.inviterUid,
        inviteeUid: inviteeUid,
        status: 'accepted',
      },
    });

    if (existingActivation) {
      return { success: false, errMsg: 'settings.account.activateInvitationCodeAlreadyActivated' };
    }
    const now = new Date();
    // Update invitation code status and set invitee
    await this.prisma.invitationCode.update({
      where: { code },
      data: {
        status: 'accepted',
        inviteeUid,
        updatedAt: now,
      },
    });

    // Update user preferences
    const user = await this.prisma.user.findUnique({
      where: { uid: inviteeUid },
      select: { preferences: true },
    });

    const currentPreferences = user?.preferences ? JSON.parse(user.preferences) : {};
    const updatedPreferences = {
      ...currentPreferences,
      hasBeenInvited: true,
    };

    await this.prisma.user.update({
      where: { uid: inviteeUid },
      data: {
        preferences: JSON.stringify(updatedPreferences),
      },
    });

    // Create credit recharges for both users
    await this.creditService.createInvitationActivationCreditRecharge(
      invitationCode.inviterUid,
      inviteeUid,
      now,
    );

    return { success: true };
  }

  /**
   * skip invitation code for user
   * set hasBeenInvited to true in user preferences
   */
  async skipInvitationCode(uid: string): Promise<BaseResponse> {
    const user = await this.prisma.user.findUnique({
      where: { uid },
      select: { preferences: true },
    });

    const currentPreferences = user?.preferences ? JSON.parse(user.preferences) : {};
    const updatedPreferences = {
      ...currentPreferences,
      hasBeenInvited: true,
    };

    await this.prisma.user.update({
      where: { uid },
      data: {
        preferences: JSON.stringify(updatedPreferences),
      },
    });

    return { success: true };
  }
}
