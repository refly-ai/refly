/**
 * DTO types for webhook operations
 * Note: This project uses inline validation, not class-validator decorators
 */

/**
 * DTO for enabling webhook
 */
export interface EnableWebhookDto {
  canvasId: string;
  timeout?: number;
}

/**
 * DTO for disabling webhook
 */
export interface DisableWebhookDto {
  webhookId: string;
}

/**
 * DTO for resetting webhook
 */
export interface ResetWebhookDto {
  webhookId: string;
}

/**
 * DTO for updating webhook configuration
 */
export interface UpdateWebhookDto {
  isEnabled?: boolean;
  timeout?: number;
}

/**
 * DTO for getting call history
 */
export interface GetCallHistoryDto {
  webhookId: string;
  page?: number;
  pageSize?: number;
}
