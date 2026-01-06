/**
 * Image utility functions for tool processing
 *
 * Includes:
 * - Image compression for AI-readable optimization
 * - Smart API selection (base64 vs File API)
 */

import mime from 'mime';
import sharp from 'sharp';
import * as fs from 'node:fs/promises';

/**
 * Get file extension from MIME type using the mime package
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const ext = mime.getExtension(mimeType);
  return ext ? `.${ext}` : '.bin';
}

// ============================================================================
// Image Compression for AI Processing
// ============================================================================

/** Default maximum size for compressed images (5MB) */
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Minimum dimensions to preserve (don't go below this) */
const MIN_DIMENSION = 256;

/** WebP quality settings */
const WEBP_QUALITY = 88;
const WEBP_EFFORT = 4;

/**
 * Compression options
 */
export interface CompressOptions {
  /** Target maximum size in bytes (default: 5MB) */
  maxSizeBytes?: number;

  /** Compression mode:
   * - ai-readable: Full pipeline with normalization and sharpening (default)
   * - balanced: Light processing, good for photos
   * - minimal: Size reduction only, no preprocessing
   */
  mode?: 'ai-readable' | 'balanced' | 'minimal';

  /** Skip compression if already under maxSizeBytes (default: true) */
  skipIfSmall?: boolean;
}

/**
 * Result of image compression
 */
export interface CompressResult {
  /** Compressed image buffer */
  buffer: Buffer;

  /** MIME type of output (always 'image/webp' after compression) */
  mimeType: string;

  /** Original file size in bytes */
  originalSize: number;

  /** Compressed file size in bytes */
  compressedSize: number;

  /** Whether compression was applied */
  wasCompressed: boolean;

  /** Original dimensions */
  originalDimensions?: { width: number; height: number };

  /** Final dimensions after compression */
  finalDimensions?: { width: number; height: number };
}

/**
 * Compress an image for AI processing (vision_read tool)
 *
 * Uses aggressive, single-pass compression strategy:
 * 1. Calculate scale factor based on size ratio
 * 2. Apply AI-readable preprocessing (normalize, sharpen)
 * 3. Resize and convert to WebP
 *
 * @param input - Buffer or file path to the image
 * @param mimeType - Original MIME type of the image
 * @param options - Compression options
 */
export async function compressImageForAI(
  input: Buffer | string,
  mimeType: string,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const {
    maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    mode = 'ai-readable',
    skipIfSmall = true,
  } = options;

  // Get input buffer and size
  let inputBuffer: Buffer;
  if (Buffer.isBuffer(input)) {
    inputBuffer = input;
  } else {
    inputBuffer = await fs.readFile(input);
  }
  const originalSize = inputBuffer.length;

  // Get image metadata
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const { width = 0, height = 0 } = metadata;

  // Check if we can skip compression
  if (skipIfSmall && originalSize <= maxSizeBytes) {
    // Already small enough, return as-is if it's a supported format
    const supportedFormats = ['image/webp', 'image/png', 'image/jpeg'];
    if (supportedFormats.includes(mimeType.toLowerCase())) {
      return {
        buffer: inputBuffer,
        mimeType,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
        originalDimensions: { width, height },
        finalDimensions: { width, height },
      };
    }
  }

  // Calculate aggressive scale factor based on size ratio
  // We use sqrt because image size roughly correlates with width * height
  const sizeRatio = originalSize / maxSizeBytes;
  let scaleFactor = 1;

  if (sizeRatio > 1) {
    // Apply 80% safety margin to ensure we stay under the limit
    scaleFactor = Math.sqrt(1 / sizeRatio) * 0.8;
  }

  // Calculate new dimensions (respecting minimum)
  let newWidth = Math.max(Math.round(width * scaleFactor), MIN_DIMENSION);
  let newHeight = Math.max(Math.round(height * scaleFactor), MIN_DIMENSION);

  // Maintain aspect ratio if we hit the minimum
  if (newWidth === MIN_DIMENSION && width > 0) {
    newHeight = Math.round((height / width) * MIN_DIMENSION);
  } else if (newHeight === MIN_DIMENSION && height > 0) {
    newWidth = Math.round((width / height) * MIN_DIMENSION);
  }

  // Build the Sharp pipeline based on mode
  let pipeline = sharp(inputBuffer);

  switch (mode) {
    case 'ai-readable':
      // Full AI-readable pipeline
      pipeline = pipeline
        // CLAHE-like local contrast enhancement via normalize
        .normalize()
        // Unsharp mask for edge sharpening (helps OCR/text recognition)
        .sharpen({
          sigma: 1.5,
          m1: 0.5, // flat areas
          m2: 0.5, // jagged areas
        });
      break;

    case 'balanced':
      // Light processing - just normalize
      pipeline = pipeline.normalize();
      break;

    case 'minimal':
      // No preprocessing, just resize
      break;
  }

  // Apply resize if dimensions changed
  if (newWidth < width || newHeight < height) {
    pipeline = pipeline.resize({
      width: newWidth,
      height: newHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Convert to WebP with high quality settings
  pipeline = pipeline.webp({
    quality: WEBP_QUALITY,
    effort: WEBP_EFFORT,
    // Smart subsample: less aggressive chroma subsampling for better quality
    smartSubsample: true,
  });

  // Execute the pipeline
  const outputBuffer = await pipeline.toBuffer();

  // Get final dimensions
  const finalMetadata = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    mimeType: 'image/webp',
    originalSize,
    compressedSize: outputBuffer.length,
    wasCompressed: true,
    originalDimensions: { width, height },
    finalDimensions: {
      width: finalMetadata.width || newWidth,
      height: finalMetadata.height || newHeight,
    },
  };
}

/**
 * Calculate total size of compressed images
 * Useful for API selection (base64 vs File API threshold)
 *
 * @param results - Array of compression results
 */
export function calculateTotalSize(results: CompressResult[]): number {
  return results.reduce((sum, r) => sum + r.compressedSize, 0);
}

/**
 * Check if total image size requires File API (vs inline base64)
 * Threshold: 20MB total
 *
 * @param results - Array of compression results
 * @param threshold - Size threshold in bytes (default: 20MB)
 */
export function shouldUseFileApi(results: CompressResult[], threshold = 20 * 1024 * 1024): boolean {
  return calculateTotalSize(results) >= threshold;
}
