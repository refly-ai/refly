import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '@prisma/client';
import { VoucherService } from './voucher.service';
import {
  GetAvailableVouchersResponse,
  ListUserVouchersResponse,
  ValidateVoucherRequest,
  ValidateVoucherResponse,
  CreateVoucherInvitationRequest,
  CreateVoucherInvitationResponse,
  VerifyVoucherInvitationResponse,
  ClaimVoucherInvitationRequest,
  ClaimVoucherInvitationResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';

@Controller('v1/voucher')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  /**
   * Get user's available (unused, not expired) vouchers
   */
  @UseGuards(JwtAuthGuard)
  @Get('available')
  async getAvailableVouchers(
    @LoginedUser() user: UserModel,
  ): Promise<GetAvailableVouchersResponse> {
    const result = await this.voucherService.getAvailableVouchers(user.uid);
    return buildSuccessResponse(result);
  }

  /**
   * List all vouchers for current user
   */
  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listUserVouchers(@LoginedUser() user: UserModel): Promise<ListUserVouchersResponse> {
    const vouchers = await this.voucherService.getUserVouchers(user.uid);
    return buildSuccessResponse(vouchers);
  }

  /**
   * Validate a voucher before use
   */
  @UseGuards(JwtAuthGuard)
  @Post('validate')
  async validateVoucher(
    @LoginedUser() user: UserModel,
    @Body() request: ValidateVoucherRequest,
  ): Promise<ValidateVoucherResponse> {
    const result = await this.voucherService.validateVoucher(user.uid, request.voucherId);
    return buildSuccessResponse(result);
  }

  /**
   * Create a sharing invitation for a voucher
   */
  @UseGuards(JwtAuthGuard)
  @Post('invitation/create')
  async createInvitation(
    @LoginedUser() user: UserModel,
    @Body() request: CreateVoucherInvitationRequest,
  ): Promise<CreateVoucherInvitationResponse> {
    const result = await this.voucherService.createInvitation(user.uid, request.voucherId);
    return buildSuccessResponse(result);
  }

  /**
   * Verify an invitation code (public endpoint - no auth required)
   */
  @Get('invitation/verify')
  async verifyInvitation(
    @Query('code') inviteCode: string,
  ): Promise<VerifyVoucherInvitationResponse> {
    const invitation = await this.voucherService.verifyInvitation(inviteCode);
    return buildSuccessResponse(invitation);
  }

  /**
   * Claim an invitation
   */
  @UseGuards(JwtAuthGuard)
  @Post('invitation/claim')
  async claimInvitation(
    @LoginedUser() user: UserModel,
    @Body() request: ClaimVoucherInvitationRequest,
  ): Promise<ClaimVoucherInvitationResponse> {
    const result = await this.voucherService.claimInvitation({
      inviteCode: request.inviteCode,
      inviteeUid: user.uid,
    });
    return buildSuccessResponse(result);
  }
}
