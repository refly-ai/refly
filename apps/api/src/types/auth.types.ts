/**
 * Shared authentication types
 */

/**
 * Extended user object with uid
 * Used for authenticated requests across webhook and OpenAPI modules
 */
export interface AuthenticatedUser {
  uid: string;
  [key: string]: unknown;
}
