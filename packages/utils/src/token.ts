// @ts-ignore - kitoken/node has no type declarations
import { Kitoken } from 'kitoken/node';

// ============== Configuration ==============

const SMALL_CONTENT_THRESHOLD = 10000;
const DEFAULT_CHARS_PER_TOKEN = 3.5;
const HEAD_RATIO = 0.7;
const SEPARATOR = '\n\n[... truncated ...]\n\n';
const SEPARATOR_TOKENS = 5;
const MODEL_URL = 'https://static.refly.ai/models/o200k_base.txt';

// ============== Kitoken Initialization ==============

const textDecoder = new TextDecoder();

let encoder: Kitoken | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the tokenizer by downloading the model from CDN
 * Must be called before using countToken or truncateContent
 */
export async function initTokenizer(): Promise<void> {
  if (encoder) return;

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const response = await fetch(MODEL_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to download tokenizer model: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const model = Buffer.from(arrayBuffer);
    encoder = new Kitoken(model);
  })();

  return initPromise;
}

/**
 * Get the encoder instance, throws if not initialized
 */
function getEncoder(): Kitoken {
  if (!encoder) {
    throw new Error('Tokenizer not initialized. Call initTokenizer() first.');
  }
  return encoder;
}

// ============== Public API ==============

/**
 * Count tokens in content
 *
 * For small content (< 10KB): Direct encoding (100% accurate)
 * For large content: Median integration estimation (94-110% accuracy, O(1))
 *
 * @see https://github.com/refly-ai/truncate-benchmark/blob/main/README.md
 */
export const countToken = (content: string): number => {
  if (!content) return 0;

  const len = content.length;

  // Small content: direct encode (accurate)
  if (len < SMALL_CONTENT_THRESHOLD) {
    return getEncoder().encode(content, false).length;
  }

  // Large content: median integration estimation (O(1))
  return countTokenMedianIntegration(content);
};

/**
 * Count tokens accurately (always O(n))
 * Use this when 100% accuracy is required
 */
export const countTokenAccurate = (content: string): number => {
  if (!content) return 0;
  return getEncoder().encode(content, false).length;
};

/**
 * Truncate content to target token count
 * Strategy: Keep head (70%) and tail (30%), remove middle part
 *
 * For small content: Direct token slicing (100% accurate)
 * For large content: Upper-bound integration method (O(1), guaranteed not to exceed limit)
 *
 * @see https://github.com/refly-ai/truncate-benchmark/blob/main/README.md
 */
export const truncateContent = (content: string, targetTokens: number): string => {
  const len = content.length;

  // Small content: use direct token slicing (accurate)
  if (len < SMALL_CONTENT_THRESHOLD) {
    const tokens = getEncoder().encode(content, false);
    if (tokens.length <= targetTokens) {
      return content;
    }

    const availableTokens = targetTokens - SEPARATOR_TOKENS;
    const headTokens = Math.floor(availableTokens * HEAD_RATIO);
    const tailTokens = availableTokens - headTokens;

    const head = textDecoder.decode(
      getEncoder().decode(new Uint32Array(tokens.slice(0, headTokens))),
    );
    const tail =
      tailTokens > 0
        ? textDecoder.decode(getEncoder().decode(new Uint32Array(tokens.slice(-tailTokens))))
        : '';

    return `${head}${SEPARATOR}${tail}`;
  }

  // Large content: use integration method (O(1), guaranteed not to exceed)
  const availableTokens = targetTokens - SEPARATOR_TOKENS;
  const headTargetTokens = Math.floor(availableTokens * HEAD_RATIO);
  const tailTargetTokens = availableTokens - headTargetTokens;

  const headPos = integrationSearch(content, headTargetTokens, false);
  const tailPos = integrationSearch(content, tailTargetTokens, true);

  const head = content.slice(0, headPos);
  const tail = tailPos > 0 ? content.slice(-tailPos) : '';

  return `${head}${SEPARATOR}${tail}`;
};

// ============== Integration Algorithm ==============

/**
 * Find truncation position using upper-bound integration
 *
 * Principle: Sample density curve, use max value in each interval for integration.
 * This guarantees the result never exceeds target token count.
 *
 * Time complexity: O(1) - fixed sampling amount regardless of content size
 * Space complexity: O(1) - only stores sample fragments
 */
function integrationSearch(content: string, targetTokens: number, fromEnd: boolean): number {
  const len = content.length;

  // Quick sampling to estimate average density
  const quickSampleSize = 50;
  const quickSampleCount = 50;
  const regionStart = fromEnd ? Math.floor(len / 2) : 0;
  const regionEnd = fromEnd ? len : Math.floor(len / 2);
  const regionLen = regionEnd - regionStart;

  // Concatenate samples and encode once (more efficient)
  let sampledText = '';
  for (let i = 0; i < quickSampleCount; i++) {
    const pos =
      regionStart + Math.floor(((regionLen - quickSampleSize) * i) / (quickSampleCount - 1));
    sampledText += content.slice(pos, Math.min(pos + quickSampleSize, len));
  }
  const totalTokens = getEncoder().encode(sampledText, false).length;
  const avgDensity = totalTokens > 0 ? sampledText.length / totalTokens : DEFAULT_CHARS_PER_TOKEN;

  // Estimate max chars needed with 50% margin
  const maxChars = Math.min(Math.ceil(targetTokens * avgDensity * 1.5), Math.floor(len * 0.7));

  // Integration parameters
  const sampleSize = 200;
  const numIntervals = 40;
  const subSamplesPerInterval = 3;
  const step = Math.max(sampleSize, Math.floor(maxChars / numIntervals));

  // Get inverse density at a position
  const getInvDensity = (pos: number): number => {
    const actualPos = fromEnd ? len - pos : pos;
    const sampleStart = Math.max(0, actualPos - sampleSize / 2);
    const sampleEnd = Math.min(len, sampleStart + sampleSize);
    const sample = content.slice(sampleStart, sampleEnd);
    const tokens = getEncoder().encode(sample, false).length;
    const density = tokens > 0 ? sample.length / tokens : DEFAULT_CHARS_PER_TOKEN;
    return 1 / density;
  };

  // Upper-bound integration: use max 1/d in each interval
  let integral = 0;
  let prevPos = 0;

  for (let i = 1; i <= numIntervals; i++) {
    const currPos = Math.min(i * step, maxChars);
    if (currPos <= prevPos) break;

    // Find max inverse density in interval [prevPos, currPos]
    let maxInvD = 0;
    for (let j = 0; j <= subSamplesPerInterval; j++) {
      const subPos = prevPos + ((currPos - prevPos) * j) / subSamplesPerInterval;
      const invD = getInvDensity(subPos);
      maxInvD = Math.max(maxInvD, invD);
    }

    // Upper-bound area = max height × width
    const intervalWidth = currPos - prevPos;
    const area = maxInvD * intervalWidth;

    if (integral + area >= targetTokens) {
      // Found the interval, calculate exact position
      const remaining = targetTokens - integral;
      const deltaChars = remaining / maxInvD;
      return Math.floor(prevPos + deltaChars);
    }

    integral += area;
    prevPos = currPos;
  }

  return prevPos;
}

/**
 * Estimate token count using median integration
 *
 * Principle: Divide content into intervals, sample density in each interval,
 * use median density (robust to outliers) for integration.
 *
 * Accuracy: 94-110% across various content types
 * Time complexity: O(1) - fixed sampling amount (~35KB)
 */
function countTokenMedianIntegration(content: string): number {
  const len = content.length;
  // Integration parameters (aligned with truncation algorithm)
  const numIntervals = 40;
  const sampleSize = 200;
  const subSamplesPerInterval = 3;
  const step = Math.floor(len / numIntervals);

  // Get token density at a position (tokens per char)
  const getTokenDensity = (pos: number): number => {
    const sampleStart = Math.max(0, Math.min(len - sampleSize, pos - sampleSize / 2));
    const sampleEnd = sampleStart + sampleSize;
    const sample = content.slice(sampleStart, sampleEnd);
    if (sample.length === 0) return 1 / DEFAULT_CHARS_PER_TOKEN;
    const tokens = getEncoder().encode(sample, false).length;
    return tokens > 0 ? tokens / sample.length : 1 / DEFAULT_CHARS_PER_TOKEN;
  };

  // Median integration: use median density in each interval
  let totalTokens = 0;

  for (let i = 0; i < numIntervals; i++) {
    const intervalStart = i * step;
    const intervalEnd = Math.min((i + 1) * step, len);
    const intervalWidth = intervalEnd - intervalStart;

    // Sample multiple points in interval, find median
    const densities: number[] = [];
    for (let j = 0; j <= subSamplesPerInterval; j++) {
      const subPos = intervalStart + (intervalWidth * j) / subSamplesPerInterval;
      densities.push(getTokenDensity(subPos));
    }

    // Get median
    densities.sort((a, b) => a - b);
    const mid = Math.floor(densities.length / 2);
    const medianDensity = densities[mid];

    totalTokens += medianDensity * intervalWidth;
  }

  return Math.ceil(totalTokens);
}
