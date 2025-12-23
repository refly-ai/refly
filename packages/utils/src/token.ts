import { get_encoding, type Tiktoken } from 'tiktoken';

// Singleton encoder instance - avoid repeated WASM initialization
let encoder: Tiktoken | null = null;

// TextDecoder for converting Uint8Array to string
const textDecoder = new TextDecoder();

/**
 * Get tiktoken encoder instance (lazy init, cached)
 * Uses cl100k_base encoding (GPT-4, GPT-3.5-turbo)
 */
function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = get_encoding('cl100k_base');
  }
  return encoder;
}

/**
 * Count tokens in content using tiktoken (Rust WASM)
 * ~10x faster than pure JS implementations
 */
export const countToken = (content: string): number => {
  if (!content) return 0;
  return getEncoder().encode(content).length;
};

/**
 * Truncate content to target token count
 * Strategy: Keep head (70%) and tail (30%), remove middle part
 *
 * Optimized: Direct token slicing instead of iterative char adjustment
 */
export const truncateContent = (content: string, targetTokens: number): string => {
  const enc = getEncoder();
  const tokens = enc.encode(content);

  if (tokens.length <= targetTokens) {
    return content;
  }

  // Strategy: Keep 70% at head, 30% at tail
  const headRatio = 0.7;
  const tailRatio = 0.3;

  // Reserve tokens for truncation message
  const truncationMessageTokens = 50;
  if (targetTokens <= truncationMessageTokens) {
    // Target too small to include truncation message, return minimal content
    const minimalTokens = tokens.slice(0, Math.min(tokens.length, targetTokens));
    return textDecoder.decode(enc.decode(new Uint32Array(minimalTokens)));
  }

  const availableTokens = targetTokens - truncationMessageTokens;
  const headTargetTokens = Math.floor(availableTokens * headRatio);
  const tailTargetTokens = Math.floor(availableTokens * tailRatio);

  // Direct token slicing - no iteration needed (much faster than char-based approach)
  const headTokens = tokens.slice(0, headTargetTokens);
  const tailTokens = tokens.slice(-tailTargetTokens);

  const headContent = textDecoder.decode(enc.decode(new Uint32Array(headTokens)));
  const tailContent = textDecoder.decode(enc.decode(new Uint32Array(tailTokens)));
  const removedTokens = tokens.length - headTargetTokens - tailTargetTokens;

  return `${headContent}\n\n[... Truncated ~${removedTokens} tokens ...]\n\n${tailContent}`;
};

/**
 * Dispose encoder instance (for cleanup on process exit)
 * Call this if you need to free WASM memory
 */
export const disposeTokenizer = (): void => {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
};
