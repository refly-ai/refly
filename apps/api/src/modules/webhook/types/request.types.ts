import { Request } from 'express';
import { AuthenticatedUser } from '../../../types/auth.types';

/**
 * Extended Express Request for webhook endpoints
 */
export interface WebhookRequest extends Request {
  user?: AuthenticatedUser;
  uid?: string; // For webhook authenticated requests
}
