/**
 * Token and Text Processing Utilities
 *
 * Shared utility functions for token estimation, text truncation,
 * URL filtering, and object manipulation.
 * Used by tool post-handlers and other services.
 */

// ============================================================================
// Constants
// ============================================================================

// Token limits for tool result compression
export const DEFAULT_MAX_TOKENS = 4000; // Max tokens for entire tool result (~16KB)
export const MAX_SNIPPET_TOKENS = 800; // Max tokens per content snippet (~3.2KB)

// Link filtering constants
export const TOP_K_LINKS = 30; // Keep top 10 links total
export const MAX_PER_DOMAIN = 10; // Max 3 links per domain (allows diversity while not losing all same-domain results)
export const MIN_CONTENT_LENGTH = 100; // Skip items with content < 100 chars (low quality)

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count from text (4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

/**
 * Truncate text to max tokens with head/tail preservation
 * Used for final JSON string output
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return '';
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  const headChars = Math.floor(maxChars * 0.7);
  const tailChars = Math.floor(maxChars * 0.3);
  const head = text.slice(0, headChars);
  const tail = text.slice(-tailChars);

  return `${head}\n\n...[truncated ~${Math.ceil((text.length - maxChars) / 4)} tokens]...\n\n${tail}`;
}

// ============================================================================
// URL Processing (must be before truncation functions)
// ============================================================================

/**
 * Extract root domain from URL for deduplication
 */
export function extractRootDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length > 2) {
      const knownTLDs = ['co.uk', 'com.cn', 'com.au', 'co.jp', 'org.uk'];
      const lastTwo = parts.slice(-2).join('.');
      if (knownTLDs.includes(lastTwo)) {
        return parts.slice(-3).join('.');
      }
      return lastTwo;
    }
    return hostname;
  } catch {
    return url;
  }
}

/**
 * Filter and dedupe URL array by domain
 */
export function filterAndDedupeUrls(urls: string[]): string[] {
  if (!Array.isArray(urls)) return [];

  const domainCounts = new Map<string, number>();
  const filtered: string[] = [];

  for (const url of urls) {
    if (!url || typeof url !== 'string') continue;

    const domain = extractRootDomain(url);
    const count = domainCounts.get(domain) ?? 0;

    if (count < MAX_PER_DOMAIN) {
      filtered.push(url);
      domainCounts.set(domain, count + 1);
      if (filtered.length >= TOP_K_LINKS) break;
    }
  }

  return filtered;
}

/**
 * Extract all URLs from raw text content
 * Uses indexOf-based scanning for better performance on large texts
 */
export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];

  const urls: string[] = [];
  const len = text.length;
  let i = 0;

  // URL terminator characters
  const terminators = new Set([' ', '\t', '\n', '\r', ']', ')', '>', '"', "'"]);
  // Trailing punctuation to remove
  const trailingPunct = new Set(['.', ',', ';', ':', '!', '?', ')']);

  while (i < len) {
    // Fast scan for 'http'
    const httpIdx = text.indexOf('http', i);
    if (httpIdx === -1) break;

    // Check for http:// or https://
    const isHttps = text.startsWith('https://', httpIdx);
    const isHttp = !isHttps && text.startsWith('http://', httpIdx);

    if (!isHttp && !isHttps) {
      i = httpIdx + 1;
      continue;
    }

    // Find end of URL
    const start = httpIdx;
    let end = start + (isHttps ? 8 : 7); // Skip past protocol

    while (end < len && !terminators.has(text[end])) {
      end++;
    }

    // Extract and clean URL
    let url = text.slice(start, end);

    // Remove trailing punctuation
    while (url.length > 0 && trailingPunct.has(url[url.length - 1])) {
      url = url.slice(0, -1);
    }

    if (url.length > 10) {
      // Minimum valid URL length
      urls.push(url);
    }

    i = end;
  }

  return urls;
}

// Fast noise detection using string matching instead of regex where possible
// Pre-computed lowercase sets for O(1) lookup
const NOISE_EXACT_LOWER = new Set([
  'sign in',
  'subscribe',
  'share',
  'download',
  'save',
  'cancel',
  'confirm',
  'show more',
  'show less',
  'load more',
  'see more',
  'live',
  'new',
  'playlist',
  'mix',
]);

const NOISE_PREFIX_LOWER = ['about', 'contact', 'privacy', 'terms', 'help', 'copyright'];

/**
 * Check if string is a video timestamp like "0:00", "12:34", "1:23:45"
 */
function isTimestamp(s: string): boolean {
  const len = s.length;
  if (len < 3 || len > 8) return false;

  let colonCount = 0;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (c === 58) {
      // ':'
      colonCount++;
      if (colonCount > 2) return false;
    } else if (c < 48 || c > 57) {
      // not 0-9
      return false;
    }
  }
  return colonCount >= 1;
}

/**
 * Check if string is a markdown image reference like "![Image 1]"
 */
function isMarkdownImageRef(s: string): boolean {
  return (
    s.length > 8 &&
    s.charCodeAt(0) === 33 &&
    s.charCodeAt(1) === 91 && // "!["
    s.startsWith('![Image ') &&
    s.charCodeAt(s.length - 1) === 93
  ); // ends with "]"
}

/**
 * Check if string is a standalone markdown link like "[](url)" or "(url)"
 */
function isStandaloneLink(s: string): boolean {
  const len = s.length;
  if (len < 10) return false;

  // Check for (http...) pattern
  const first = s.charCodeAt(0);
  if (first === 40 || (first === 91 && s.charCodeAt(1) === 93 && s.charCodeAt(2) === 40)) {
    // '(' or '[]('
    return s.includes('http') && s.charCodeAt(len - 1) === 41; // ends with ')'
  }
  return false;
}

/**
 * Check if string looks like view count "123K views • 2 days ago"
 */
function isViewCount(s: string): boolean {
  const lower = s.toLowerCase();
  return (lower.includes('view') || lower.includes('subscriber')) && /^\d/.test(s); // starts with digit
}

/**
 * Check if a line is noise (navigation, badges, etc.)
 * Optimized: uses string matching and Set lookup instead of regex iteration
 * Note: expects pre-trimmed input from caller
 */
function isNoiseLine(line: string): boolean {
  if (!line) return true;
  if (line.length < 3) return true;

  const lower = line.toLowerCase();

  // O(1) exact match lookup
  if (NOISE_EXACT_LOWER.has(lower)) return true;

  // Prefix checks (short list, faster than regex)
  for (const prefix of NOISE_PREFIX_LOWER) {
    if (lower.startsWith(prefix)) return true;
  }

  // Specific pattern checks (faster than regex for common cases)
  if (isTimestamp(line)) return true;
  if (isMarkdownImageRef(line)) return true;
  if (isStandaloneLink(line)) return true;
  if (isViewCount(line)) return true;

  return false;
}

/**
 * Fast string hash for deduplication (FNV-1a variant)
 * Much faster than storing full normalized strings
 */
function fastHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

/**
 * Normalize line for deduplication without regex
 * Converts to lowercase and collapses whitespace in single pass
 */
function normalizeLineForDedupe(line: string): string {
  const result: string[] = [];
  let prevSpace = true; // Start true to skip leading spaces

  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    // Check for whitespace (space, tab, newline, carriage return)
    if (c === 32 || c === 9 || c === 10 || c === 13) {
      if (!prevSpace) {
        result.push(' ');
        prevSpace = true;
      }
    } else {
      // Convert to lowercase inline (A-Z: 65-90)
      result.push(c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : line[i]);
      prevSpace = false;
    }
  }

  // Remove trailing space if present
  if (result.length > 0 && result[result.length - 1] === ' ') {
    result.pop();
  }

  return result.join('');
}

/**
 * Core function: Extract and filter content from raw text.
 * This is the internal implementation used by both truncateContent and extractAndFilterContent.
 * Uses simple truncation at the end to avoid circular dependency.
 *
 * Optimized for performance:
 * - Single-pass line processing with inline normalization
 * - Hash-based deduplication instead of full string storage
 * - Avoids regex in hot path
 */
function extractAndFilterContentCore(
  text: string,
  maxTokens: number,
): {
  content: string;
  urls: string[];
  originalUrlCount: number;
  stats: {
    originalLines: number;
    keptLines: number;
    originalTokens: number;
    finalTokens: number;
  };
} {
  if (!text) {
    return {
      content: '',
      urls: [],
      originalUrlCount: 0,
      stats: { originalLines: 0, keptLines: 0, originalTokens: 0, finalTokens: 0 },
    };
  }

  // Step 1: Extract all URLs before cleaning
  const allUrls = extractUrlsFromText(text);
  const originalUrlCount = allUrls.length;

  // Step 2: Filter and dedupe URLs
  const filteredUrls = filterAndDedupeUrls(allUrls);

  // Step 3: Clean content - remove noise lines
  // Process line by line without split() to reduce allocations
  const len = text.length;
  const cleanedLines: string[] = [];
  const seenHashes = new Set<number>(); // Hash-based dedupe
  let lineStart = 0;
  let originalLines = 0;

  for (let i = 0; i <= len; i++) {
    // Check for line end (newline or end of string)
    if (i === len || text.charCodeAt(i) === 10) {
      originalLines++;

      // Extract line and trim inline
      let start = lineStart;
      let end = i;

      // Handle \r\n
      if (end > start && text.charCodeAt(end - 1) === 13) {
        end--;
      }

      // Trim leading whitespace
      while (start < end && (text.charCodeAt(start) === 32 || text.charCodeAt(start) === 9)) {
        start++;
      }

      // Trim trailing whitespace
      while (end > start && (text.charCodeAt(end - 1) === 32 || text.charCodeAt(end - 1) === 9)) {
        end--;
      }

      const trimmed = text.slice(start, end);

      // Skip noise
      if (!isNoiseLine(trimmed)) {
        // Normalize and hash for dedupe
        const normalized = normalizeLineForDedupe(trimmed);
        const hash = fastHash(normalized);

        if (!seenHashes.has(hash)) {
          seenHashes.add(hash);
          cleanedLines.push(trimmed);
        }
      }

      lineStart = i + 1;
    }
  }

  // Step 4: Build final content with URLs section
  let cleanedContent = cleanedLines.join('\n');

  // Add filtered URLs section at the end
  if (filteredUrls.length > 0) {
    const urlLines = filteredUrls.map((u) => `- ${u}`);
    const urlSection = `\n\n---\nRelevant URLs (${filteredUrls.length}/${originalUrlCount}):\n${urlLines.join('\n')}`;
    cleanedContent += urlSection;
  }

  // Step 5: Truncate if still too long (use simple truncation to avoid circular dependency)
  const maxChars = maxTokens * 4;
  let finalContent = cleanedContent;
  if (cleanedContent.length > maxChars) {
    const truncated = cleanedContent.slice(0, maxChars);
    const omittedTokens = Math.ceil((cleanedContent.length - maxChars) / 4);
    finalContent = `${truncated}... [${omittedTokens} tokens omitted]`;
  }

  // Calculate tokens only at the end when needed
  const originalTokens = Math.ceil(text.length / 4);
  const finalTokens = Math.ceil(finalContent.length / 4);

  return {
    content: finalContent,
    urls: filteredUrls,
    originalUrlCount,
    stats: {
      originalLines,
      keptLines: cleanedLines.length,
      originalTokens,
      finalTokens,
    },
  };
}

// ============================================================================
// Content Truncation Functions
// ============================================================================

/**
 * Truncate text content cleanly for embedding in JSON
 * Simple head truncation only - no URL extraction or noise filtering
 */
export function truncateContentSimple(text: string, maxTokens: number): string {
  if (!text) return '';
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  // Keep head portion only, with clean truncation marker
  const truncated = text.slice(0, maxChars);
  const omittedTokens = Math.ceil((text.length - maxChars) / 4);
  return `${truncated}... [${omittedTokens} tokens omitted]`;
}

/**
 * Truncate text content with smart processing:
 * - Extract and dedupe URLs by domain
 * - Remove noise lines (navigation, badges, image refs)
 * - Dedupe identical lines
 * - Append filtered URLs section
 * - Truncate to token budget
 *
 * Falls back to simple truncation for short content or non-web content.
 */
export function truncateContent(text: string, maxTokens: number): string {
  if (!text) return '';

  const currentTokens = estimateTokens(text);

  // If already within budget, return as-is
  if (currentTokens <= maxTokens) return text;

  // For short content or content without URLs, use simple truncation
  // This avoids overhead for simple text fields
  const hasUrls = /https?:\/\//.test(text);
  const isShortContent = text.length < 500;

  if (isShortContent || !hasUrls) {
    return truncateContentSimple(text, maxTokens);
  }

  // Use smart extraction for web content with URLs
  const result = extractAndFilterContentCore(text, maxTokens);
  return result.content;
}

// ============================================================================
// Item Filtering
// ============================================================================

/**
 * Filter and dedupe items by URL domain
 */
export function filterAndDedupeItems<
  T extends { url?: string; content?: string; snippet?: string; text?: string },
>(items: T[]): { filtered: T[]; originalCount: number } {
  if (!Array.isArray(items)) {
    return { filtered: [], originalCount: 0 };
  }

  const originalCount = items.length;
  const domainCounts = new Map<string, number>();
  const filtered: T[] = [];

  for (const item of items) {
    if (!item.url) continue;
    // Check content, snippet, or text (Exa uses 'text' field)
    const contentLength = (item.content ?? item.snippet ?? item.text ?? '').length;
    if (contentLength < MIN_CONTENT_LENGTH) continue;

    const domain = extractRootDomain(item.url);
    const count = domainCounts.get(domain) ?? 0;

    if (count < MAX_PER_DOMAIN) {
      filtered.push(item);
      domainCounts.set(domain, count + 1);
      if (filtered.length >= TOP_K_LINKS) break;
    }
  }

  return { filtered, originalCount };
}

/**
 * Extract and dedupe URLs from raw text, returning cleaned content with filtered links.
 *
 * This function:
 * 1. Extracts all URLs from raw text content
 * 2. Filters and dedupes URLs by domain (respects TOP_K_LINKS and MAX_PER_DOMAIN)
 * 3. Removes noise lines (navigation, badges, image refs)
 * 4. Returns cleaned text content + filtered unique URLs
 *
 * @param text - Raw text content (e.g., scraped web page)
 * @param maxTokens - Maximum tokens for the cleaned content
 * @returns Object with cleaned content and filtered URLs
 */
export function extractAndFilterContent(
  text: string,
  maxTokens: number,
): {
  content: string;
  urls: string[];
  originalUrlCount: number;
  stats: {
    originalLines: number;
    keptLines: number;
    originalTokens: number;
    finalTokens: number;
  };
} {
  return extractAndFilterContentCore(text, maxTokens);
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Pick specific keys from an object
 */
export function pick(obj: any, keys: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const k of keys) {
    if (obj?.[k] !== undefined) result[k] = obj[k];
  }
  return result;
}

/**
 * Safely parse JSON string
 */
export function safeParseJSON(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
