/**
 * Resource-related errors for tool execution
 */

/**
 * Error thrown when canvasId is required but missing for resource operations
 */
export class MissingCanvasContextError extends Error {
  constructor(message?: string) {
    super(
      message ||
        'canvasId is required to save files. Please ensure the tool is executed within a canvas context.',
    );
    this.name = 'MissingCanvasContextError';
  }
}
