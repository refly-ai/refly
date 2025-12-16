/**
 * Voucher System Constants
 */

// Daily popup trigger limit per user
export const DAILY_POPUP_TRIGGER_LIMIT = 999;

// Default LLM score when scoring fails (50 = 50% discount)
export const DEFAULT_LLM_SCORE = 50;

// Scoring timeout in milliseconds (10 seconds)
export const SCORING_TIMEOUT_MS = 10000;

// Minimum discount percentage
export const MIN_DISCOUNT_PERCENT = 10;

// Maximum discount percentage
export const MAX_DISCOUNT_PERCENT = 90;

// Inviter reward credits
export const INVITER_REWARD_CREDITS = 2000;

// Voucher status enum
export const VoucherStatus = {
  UNUSED: 'unused',
  USED: 'used',
  EXPIRED: 'expired',
  INVALID: 'invalid',
} as const;

export type VoucherStatusType = (typeof VoucherStatus)[keyof typeof VoucherStatus];

// Voucher source enum
export const VoucherSource = {
  TEMPLATE_PUBLISH: 'template_publish',
  INVITATION_CLAIM: 'invitation_claim',
} as const;

export type VoucherSourceType = (typeof VoucherSource)[keyof typeof VoucherSource];

// Invitation status enum
export const InvitationStatus = {
  UNCLAIMED: 'unclaimed',
  CLAIMED: 'claimed',
  EXPIRED: 'expired',
} as const;

export type InvitationStatusType = (typeof InvitationStatus)[keyof typeof InvitationStatus];

// Analytics event names
export const AnalyticsEvents = {
  VOUCHER_POPUP_DISPLAY: 'voucher_popup_display',
  VOUCHER_USE_NOW_CLICK: 'voucher_use_now_click',
  VOUCHER_SHARE_CLICK: 'voucher_share_click',
  DAILY_PUBLISH_TRIGGER_LIMIT_REACHED: 'daily_publish_trigger_limit_reached',
  VOUCHER_APPLIED: 'voucher_applied',
  VOUCHER_CLAIM: 'voucher_claim',
  POSTER_DOWNLOAD: 'poster_download',
  SHARE_LINK_COPIED: 'share_link_copied',
} as const;
