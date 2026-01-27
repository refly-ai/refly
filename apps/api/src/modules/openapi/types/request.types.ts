import { Request } from 'express';

/**
 * Extended user object with uid
 */
export interface AuthenticatedUser {
  uid: string;
  [key: string]: any;
}

/**
 * Extended Express Request with custom properties
 */
export interface OpenAPIRequest extends Request {
  user?: AuthenticatedUser;
  uid?: string; // For API key authenticated requests
}
