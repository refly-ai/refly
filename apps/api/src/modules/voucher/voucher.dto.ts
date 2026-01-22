import { VoucherStatusType, VoucherSourceType, InvitationStatusType } from './voucher.constants';

/**
 * Voucher DTO
 */
export interface VoucherDTO {
  voucherId: string;
  uid: string;
  discountPercent: number;
  status: VoucherStatusType;
  source: VoucherSourceType;
  sourceId?: string;
  llmScore?: number;
  expiresAt: string;
  usedAt?: string;
  subscriptionId?: string;
  stripePromoCodeId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Voucher Input
 */
export interface CreateVoucherInput {
  uid: string;
  discountPercent: number;
  llmScore?: number;
  source: VoucherSourceType;
  sourceId?: string;
  expiresAt: Date;
}

/**
 * Update Voucher Input
 */
export interface UpdateVoucherInput {
  discountPercent?: number;
  llmScore?: number;
  expiresAt?: Date;
  sourceId?: string;
  status?: VoucherStatusType;
}

/**
 * Voucher Trigger Result - returned when template is published
 */
export interface VoucherTriggerResult {
  voucher: VoucherDTO;
  score: number;
  feedback?: string;
  triggerLimitReached?: boolean;
}

/**
 * Daily Trigger Check Result
 */
export interface DailyTriggerCheckResult {
  canTrigger: boolean;
  currentCount: number;
  limit: number;
}

/**
 * Voucher Invitation DTO
 */
export interface VoucherInvitationDTO {
  invitationId: string;
  inviterUid: string;
  inviteeUid?: string;
  inviteCode: string;
  voucherId: string;
  discountPercent: number;
  status: InvitationStatusType;
  claimedAt?: string;
  rewardGranted: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Invitation Result
 */
export interface CreateInvitationResult {
  invitation: VoucherInvitationDTO;
}

/**
 * Claim Invitation Input
 */
export interface ClaimInvitationInput {
  inviteCode: string;
  inviteeUid: string;
}

/**
 * Claim Invitation Result
 */
export interface ClaimInvitationResult {
  success: boolean;
  voucher?: VoucherDTO;
  inviterName?: string;
  message?: string;
}

/**
 * Voucher Available Check Result
 */
export interface VoucherAvailableResult {
  hasAvailableVoucher: boolean;
  vouchers: VoucherDTO[];
  bestVoucher?: VoucherDTO;
}

/**
 * Voucher Validate Result
 */
export interface VoucherValidateResult {
  valid: boolean;
  voucher?: VoucherDTO;
  reason?: string;
}

/**
 * Use Voucher Input
 */
export interface UseVoucherInput {
  voucherId: string;
  subscriptionId: string;
}

/**
 * Verify Invitation Result
 */
export interface VerifyInvitationResult {
  valid: boolean;
  invitation?: VoucherInvitationDTO;
  /** The original voucher being shared (for unclaimed invitations) */
  voucher?: VoucherDTO;
  /** If already claimed, who claimed it */
  claimedByUid?: string;
  /** If claimed by current user, the voucher they received */
  claimedVoucher?: VoucherDTO;
  /** Inviter's name (for display) */
  inviterName?: string;
  message?: string;
}
