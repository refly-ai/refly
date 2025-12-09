import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreditService } from '../credit/credit.service';
import { ConfigService } from '@nestjs/config';
import { InvitationCode } from '@refly/openapi-schema';
import { BaseResponse } from '@refly/openapi-schema';

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly configService: ConfigService,
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
   * list the first 5 invitation codes for a user (by creation time), generate 5 codes if none exist
   */
  async listInvitationCodes(uid: string): Promise<InvitationCode[]> {
    let invitationCodes = await this.prisma.invitationCode.findMany({
      where: { inviterUid: uid },
      orderBy: { createdAt: 'asc' },
    });

    // If no invitation codes exist, generate 5 new ones
    if (!invitationCodes || invitationCodes.length === 0) {
      // generate 5 unique invitation codes
      const codes: string[] = [];
      for (let i = 0; i < 5; i++) {
        const code = await this.generateUniqueCode();
        codes.push(code);
      }

      // create the invitation codes in batch
      invitationCodes = await Promise.all(
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
    }

    // Always return only the first 5 codes (by creation time)
    const codesToReturn = invitationCodes.slice(0, 5);

    return codesToReturn.map((code) => ({
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
  async hasBeenInvited(uid: string): Promise<boolean> {
    const requireInvitationCode =
      this.configService.get('auth.invitation.requireInvitationCode') ?? false;

    // If invitation code is not required, all users are considered invited
    if (!requireInvitationCode) {
      return true;
    }

    // If invitation code is required, check user's hasBeenInvited preference
    const user = await this.prisma.user.findUnique({
      where: { uid },
      select: { preferences: true },
    });

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
}
