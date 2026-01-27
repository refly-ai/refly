import { Request } from 'express';

/**
 * Extended user object with uid
 */
export interface AuthenticatedUser {
  uid: string;
  [key: string]: any;
}

/**
 * Extended Express Request for webhook endpoints
 */
export interface WebhookRequest extends Request {
  user?: AuthenticatedUser;
  uid?: string; // For webhook authenticated requests
}
