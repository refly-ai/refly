/**
 * Template generation status types
 */
export type TemplateGenerationStatus =
  | 'idle' // No generation needed
  | 'pending' // Generation queued, waiting to start
  | 'generating' // Generation in progress
  | 'completed' // Generation completed successfully
  | 'failed'; // Generation failed

/**
 * Template status response from API
 */
export interface TemplateStatusResponse {
  status: TemplateGenerationStatus;
  templateContent?: string | null;
  error?: string | null;
  updatedAt: string;
  createdAt: string;
}

/**
 * Determine if status badge should be shown
 * @param status - Current generation status
 * @returns true if badge should be shown
 */
export function shouldShowStatusBadge(status: TemplateGenerationStatus): boolean {
  // Don't show if idle (no generation needed)
  if (status === 'idle') {
    return false;
  }

  // Show for: pending, generating, failed
  return status === 'pending' || status === 'generating' || status === 'failed';
}
