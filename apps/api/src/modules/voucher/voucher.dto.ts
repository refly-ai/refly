import { VoucherStatusType, VoucherSourceType, InvitationStatusType } from './voucher.constants';

/**
 * Template Scoring Result
 */
export interface TemplateScoringBreakdown {
  structure: number; // 0-30
  inputDesign: number; // 0-25
  promptQuality: number; // 0-25
  reusability: number; // 0-20
}

export interface TemplateScoringResult {
  score: number; // 0-100
  breakdown?: TemplateScoringBreakdown;
  feedback?: string;
}

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
  shareUrl: string;
  qrCodeUrl?: string;
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
  message?: string;
}

/**
 * Voucher Popup Log Entry
 */
export interface VoucherPopupLogDTO {
  uid: string;
  templateId: string;
  popupDate: string;
  voucherId?: string;
  createdAt: string;
}

/**
 * Scoring Input from Canvas
 */
export interface CanvasScoringInput {
  canvasId: string;
  title?: string;
  description?: string;
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
 * Voucher Validate Request
 */
export interface VoucherValidateRequest {
  voucherId: string;
  planType?: string;
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
  /** If already claimed, who claimed it */
  claimedByUid?: string;
  message?: string;
}
