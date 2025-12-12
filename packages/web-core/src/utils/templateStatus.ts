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
