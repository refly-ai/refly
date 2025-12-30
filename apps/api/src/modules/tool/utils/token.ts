/**
 * Token and Text Processing Utilities
 *
 * Shared utility functions for token estimation, text truncation,
 * URL filtering, and object manipulation.
 * Used by tool post-handlers and other services.
 */

import { truncateContent as truncateByToken, countToken } from '@refly/utils/token';

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
 * Estimate token count from text (uses actual tokenizer)
 */
export function estimateTokens(text: string): number {
  return countToken(text ?? '');
}

/**
 * Truncate text to max tokens with head/tail preservation
 * Used for final JSON string output
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return '';
  return truncateByToken(text, maxTokens);
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

// ============================================================================
// Content Truncation and Filtering
// ============================================================================

/**
 * Truncate text content to token limit
 * Uses integration-based algorithm for O(1) performance on large content
 *
 * For web content, call this FIRST, then use filterContent on the result.
 */
export function truncateContent(text: string, maxTokens: number): string {
  if (!text) return '';
  return truncateByToken(text, maxTokens);
}

/**
 * Truncate and filter web content in one call
 * 1. Truncate first (O(1) - fast on large content)
 * 2. Filter noise and extract URLs (on shorter truncated content)
 *
 * Use this for scraped web pages. For clean content (API responses, snippets),
 * use truncateContent directly.
 */
export function truncateAndFilterContent(
  text: string,
  maxTokens: number,
): {
  content: string;
  urls: string[];
} {
  if (!text) return { content: '', urls: [] };
  const truncated = truncateByToken(text, maxTokens);
  const { content, urls } = filterContent(truncated);
  return { content, urls };
}

/**
 * Filter content: remove noise lines, dedupe, and extract URLs (no truncation)
 *
 * Call AFTER truncateContent to avoid performance issues with very long content.
 * Example:
 *   const truncated = truncateContent(rawText, maxTokens);  // O(1) - fast
 *   const { content, urls } = filterContent(truncated);      // then filter
 */
export function filterContent(text: string): {
  content: string;
  urls: string[];
  originalUrlCount: number;
} {
  if (!text) {
    return { content: '', urls: [], originalUrlCount: 0 };
  }

  // Extract all URLs before cleaning
  const allUrls = extractUrlsFromText(text);
  const originalUrlCount = allUrls.length;

  // Filter and dedupe URLs
  const filteredUrls = filterAndDedupeUrls(allUrls);

  // Step 3: Clean content - remove noise lines
  // Process line by line without split() to reduce allocations
  const len = text.length;
  const cleanedLines: string[] = [];
  const seenHashes = new Set<number>(); // Hash-based dedupe
  let lineStart = 0;

  for (let i = 0; i <= len; i++) {
    // Check for line end (newline or end of string)
    if (i === len || text.charCodeAt(i) === 10) {
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

  let cleanedContent = cleanedLines.join('\n');

  // Add filtered URLs section at the end
  if (filteredUrls.length > 0) {
    const urlLines = filteredUrls.map((u) => `- ${u}`);
    const urlSection = `\n\n---\nRelevant URLs (${filteredUrls.length}/${originalUrlCount}):\n${urlLines.join('\n')}`;
    cleanedContent += urlSection;
  }
  // Calculate tokens only at the end when needed
  return {
    content: cleanedContent,
    urls: filteredUrls,
    originalUrlCount,
  };
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
