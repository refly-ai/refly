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

/**
 * Core function: Extract and filter content from raw text.
 * This is the internal implementation used by both truncateContent and extractAndFilterContent.
 * Uses simple truncation at the end to avoid circular dependency.
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

  const originalTokens = estimateTokens(text);

  // Step 1: Extract all URLs before cleaning
  const allUrls = extractUrlsFromText(text);
  const originalUrlCount = allUrls.length;

  // Step 2: Filter and dedupe URLs
  const filteredUrls = filterAndDedupeUrls(allUrls);

  // Step 3: Clean content - remove noise lines
  const lines = text.split('\n');
  const originalLines = lines.length;

  const cleanedLines: string[] = [];
  const seenContent = new Set<string>(); // Dedupe identical lines

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip noise
    if (isNoiseLine(trimmed)) continue;

    // Skip duplicate content
    const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (seenContent.has(normalized)) continue;
    seenContent.add(normalized);

    cleanedLines.push(trimmed);
  }

  // Step 4: Build final content with URLs section
  let cleanedContent = cleanedLines.join('\n');

  // Add filtered URLs section at the end
  if (filteredUrls.length > 0) {
    const urlSection = `\n\n---\nRelevant URLs (${filteredUrls.length}/${originalUrlCount}):\n${filteredUrls.map((u) => `- ${u}`).join('\n')}`;
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

  const finalTokens = estimateTokens(finalContent);

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
