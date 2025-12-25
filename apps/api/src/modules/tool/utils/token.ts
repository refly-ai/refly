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
 */
export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];

  // Match URLs in various formats:
  // - Plain URLs: https://example.com/path
  // - Markdown links: [text](https://example.com)
  // - HTML links would be converted to markdown by scrapers
  const urlRegex = /https?:\/\/[^\s\]\)>"']+/gi;
  const matches = text.match(urlRegex) || [];

  // Clean up URLs (remove trailing punctuation)
  return matches.map((url: string) => url.replace(/[.,;:!?)]+$/, ''));
}

// Patterns to filter out noise from scraped web content
const NOISE_PATTERNS = [
  /^!\[Image \d+\]/i, // Markdown image references
  /^\[?\]?\(https?:\/\/[^)]+\)$/i, // Standalone markdown links
  /^(Sign in|Subscribe|Share|Download|Save|Cancel|Confirm)$/i, // Navigation buttons
  /^(Show more|Show less|Load more|See more)$/i, // Pagination
  /^\d+:\d+$/, // Video timestamps like "0:00"
  /^(Live|New|Playlist|Mix)$/i, // YouTube badges
  /^\d+[KMB]?\s*(views?|subscribers?)\s*•?\s*\d*\s*(days?|hours?|months?|years?)?\s*(ago)?$/i, // View counts
  /^(About|Contact|Privacy|Terms|Help|Copyright)/i, // Footer links
];

/**
 * Check if a line is noise (navigation, badges, etc.)
 */
function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length < 3) return true;

  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
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

  // Clean content - remove noise lines
  const lines = text.split('\n');
  const cleanedLines: string[] = [];
  const seenContent = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (isNoiseLine(trimmed)) continue;

    const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (seenContent.has(normalized)) continue;
    seenContent.add(normalized);

    cleanedLines.push(trimmed);
  }

  let cleanedContent = cleanedLines.join('\n');

  // Add filtered URLs section at the end
  if (filteredUrls.length > 0) {
    const urlSection = `\n\n---\nRelevant URLs (${filteredUrls.length}/${originalUrlCount}):\n${filteredUrls.map((u) => `- ${u}`).join('\n')}`;
    cleanedContent += urlSection;
  }

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
