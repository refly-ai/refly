/**
 * File ID Utilities
 *
 * Unified module for file ID validation, extraction, and replacement.
 * FileId format: df-[a-z0-9]+ (e.g., df-abc123xyz)
 *
 * This is a shared utility used across multiple packages:
 *
 * 1. packages/agent-tools/src/builtin/index.ts
 *    - BuiltinGenerateDoc.replaceFilePlaceholders() uses replaceAllMarkdownFileIds()
 *    - BuiltinGenerateCodeArtifact.replaceFilePlaceholders() uses replaceAllMarkdownFileIds()
 *    - BuiltinSendEmail.replaceFilePlaceholders() uses replaceAllHtmlFileIds()
 *    - All three use extractAllFileIds() and hasFileIds() for file ID detection
 *
 * 2. apps/api/src/modules/tool/utils/schema-utils.ts
 *    - Re-exports isValidFileId() and extractFileId() for tool parameter validation
 *
 * When adding new file ID handling logic, prefer using these shared utilities
 * to ensure consistent behavior across the codebase.
 */

// ============================================================================
// Core Patterns
// ============================================================================

/**
 * Regex pattern for matching file IDs.
 * Uses negative lookbehind to prevent matching invalid patterns like 'pdf-xxx'.
 * The pattern matches 'df-' followed by alphanumeric characters.
 */
export const FILE_ID_PATTERN = /(?<![a-z0-9])(df-[a-z0-9]+)\b/i;

/**
 * Global regex pattern for finding all file IDs in a string.
 * Same as FILE_ID_PATTERN but with global flag.
 */
export const FILE_ID_PATTERN_GLOBAL = /(?<![a-z0-9])(df-[a-z0-9]+)\b/gi;

// ============================================================================
// Context-Specific Patterns for Replacement
// ============================================================================

/**
 * Pattern for file-content:// URI format (for images, embedded media)
 * Matches: file-content://df-xxx
 */
export const FILE_CONTENT_URI_PATTERN = /file-content:\/\/(df-[a-z0-9]+)/gi;

/**
 * Pattern for file:// URI format (for share links)
 * Matches: file://df-xxx (but not file-content://)
 */
export const FILE_SHARE_URI_PATTERN = /file:\/\/(df-[a-z0-9]+)/gi;

/**
 * Pattern for bare file IDs in markdown image/link syntax
 * Matches: ](df-xxx) in ![alt](df-xxx) or [text](df-xxx)
 */
export const MARKDOWN_FILE_ID_PATTERN = /\]\((df-[a-z0-9]+)\)/gi;

/**
 * Pattern for bare file IDs in HTML src/href attributes
 * Matches: src="df-xxx" or href="df-xxx"
 */
export const HTML_ATTR_FILE_ID_PATTERN = /((?:src|href)=["'])(df-[a-z0-9]+)(["'])/gi;

/**
 * Validate if a value is a valid fileId
 * FileId can be in formats:
 * - Direct: 'df-xxx'
 * - URI format: 'fileId://df-xxx'
 * - Mention format: '@file:df-xxx'
 * - Path format: 'files/df-xxx'
 * - URL format: 'https://files.refly.ai/df-xxx'
 *
 * @param value - Value to validate (can be string or object with fileId property)
 * @returns True if the value is a valid fileId
 */
export function isValidFileId(value: unknown): boolean {
  return extractFileId(value) !== null;
}

/**
 * Extract fileId from various formats
 * @param value - Value that may contain a fileId (string or object with fileId property)
 * @returns The extracted fileId (df-xxx format) or null if not found
 */
export function extractFileId(value: unknown): string | null {
  if (typeof value === 'string') {
    return extractFileIdFromString(value);
  }
  if (value && typeof value === 'object' && 'fileId' in value) {
    const fileId = (value as { fileId: unknown }).fileId;
    return typeof fileId === 'string' ? extractFileIdFromString(fileId) : null;
  }
  return null;
}

/**
 * Extract fileId from a string in various formats
 * @param value - String value that may contain a fileId
 * @returns The extracted fileId (df-xxx format) or null if not found
 */
function extractFileIdFromString(value: string): string | null {
  // Direct format: 'df-xxx'
  if (value.startsWith('df-')) {
    const match = value.match(/^(df-[a-z0-9]+)/i);
    return match ? match[1] : null;
  }
  // URI format: 'fileId://df-xxx'
  if (value.startsWith('fileId://')) {
    const match = value.match(/^fileId:\/\/(df-[a-z0-9]+)/i);
    return match ? match[1] : null;
  }
  // Mention format: '@file:df-xxx'
  if (value.startsWith('@file:')) {
    const match = value.match(/^@file:(df-[a-z0-9]+)/i);
    return match ? match[1] : null;
  }
  // Path format: 'files/df-xxx'
  if (value.startsWith('files/')) {
    const match = value.match(/^files\/(df-[a-z0-9]+)/i);
    return match ? match[1] : null;
  }
  // URL format or fallback: extract 'df-xxx' pattern from anywhere in the string
  // Use lookbehind to ensure 'df-' is not preceded by alphanumeric (avoid matching 'pdf-xxx', 'abcdf-xxx')
  // This handles URLs like 'https://files.refly.ai/.../df-xxx' and any other format
  const match = value.match(FILE_ID_PATTERN);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Extract all fileIds from a string content (e.g., markdown, HTML)
 * @param content - String content that may contain multiple fileIds
 * @returns Array of unique fileIds found in the content
 */
export function extractAllFileIds(content: string): string[] {
  if (!content) {
    return [];
  }

  const matches = content.matchAll(FILE_ID_PATTERN_GLOBAL);
  const fileIds = new Set<string>();

  for (const match of matches) {
    fileIds.add(match[1]);
  }

  return Array.from(fileIds);
}

/**
 * Check if content contains any file IDs
 * @param content - String content to check
 * @returns True if content contains at least one file ID
 */
export function hasFileIds(content: string): boolean {
  if (!content) {
    return false;
  }
  return FILE_ID_PATTERN.test(content);
}

// ============================================================================
// Replacement Utilities
// ============================================================================

/**
 * Replace file-content://df-xxx with actual URLs
 * @param content - Content to process
 * @param urlMap - Map of fileId to URL
 * @returns Processed content
 */
export function replaceFileContentUris(content: string, urlMap: Map<string, string>): string {
  return content.replace(FILE_CONTENT_URI_PATTERN, (match, fileId: string) => {
    return urlMap.get(fileId) ?? match;
  });
}

/**
 * Replace file://df-xxx with actual URLs
 * @param content - Content to process
 * @param urlMap - Map of fileId to URL
 * @returns Processed content
 */
export function replaceFileShareUris(content: string, urlMap: Map<string, string>): string {
  return content.replace(FILE_SHARE_URI_PATTERN, (match, fileId: string) => {
    return urlMap.get(fileId) ?? match;
  });
}

/**
 * Replace bare file IDs in markdown syntax: ](df-xxx) → ](url)
 * @param content - Markdown content to process
 * @param urlMap - Map of fileId to URL
 * @returns Processed content
 */
export function replaceMarkdownFileIds(content: string, urlMap: Map<string, string>): string {
  return content.replace(MARKDOWN_FILE_ID_PATTERN, (match, fileId: string) => {
    const url = urlMap.get(fileId);
    return url ? `](${url})` : match;
  });
}

/**
 * Replace bare file IDs in HTML attributes: src="df-xxx" → src="url"
 * @param content - HTML content to process
 * @param urlMap - Map of fileId to URL
 * @returns Processed content
 */
export function replaceHtmlAttrFileIds(content: string, urlMap: Map<string, string>): string {
  return content.replace(
    HTML_ATTR_FILE_ID_PATTERN,
    (match, prefix: string, fileId: string, suffix: string) => {
      const url = urlMap.get(fileId);
      return url ? `${prefix}${url}${suffix}` : match;
    },
  );
}

// ============================================================================
// Optimized Single-Pass Replacement (for large documents)
// ============================================================================

/**
 * Combined pattern for single-pass markdown replacement
 * Matches: file-content://df-xxx | file://df-xxx | ](df-xxx) | JS string file IDs
 *
 * Groups:
 * 1: file-content://df-xxx
 * 2: file://df-xxx
 * 3: ](df-xxx) markdown link/image
 * 4-6: "df-xxx" or 'df-xxx' in JavaScript strings (for fileId: "df-xxx" patterns)
 */
const MARKDOWN_COMBINED_PATTERN =
  /file-content:\/\/(df-[a-z0-9]+)|(?<!file-content:)file:\/\/(df-[a-z0-9]+)|\]\((df-[a-z0-9]+)\)|(["'])(df-[a-z0-9]+)(["'])/gi;

/**
 * Combined pattern for single-pass HTML replacement
 * Matches: attr with file URIs | file-content://df-xxx | file://df-xxx | bare file IDs in attributes | JS string file IDs
 *
 * Groups:
 * 1-3: (src|href)="file-content://..." or (src|href)="file://..." (attribute with URI)
 * 4: standalone file-content://df-xxx
 * 5: standalone file://df-xxx
 * 6-8: src="df-xxx" or href="df-xxx" (bare IDs in attributes)
 * 9-11: "df-xxx" or 'df-xxx' in JavaScript strings (for fileId: "df-xxx" patterns)
 */
const HTML_COMBINED_PATTERN =
  /((?:src|href)=["'])(?:file-content:\/\/|file:\/\/)(df-[a-z0-9]+)(["'])|file-content:\/\/(df-[a-z0-9]+)|(?<!file-content:)file:\/\/(df-[a-z0-9]+)|((?:src|href)=["'])(df-[a-z0-9]+)(["'])|(["'])(df-[a-z0-9]+)(["'])/gi;

/**
 * Replace all file ID patterns in markdown content with URLs (optimized single-pass)
 * Handles: file-content://, file://, bare file IDs in ](df-xxx), and JS string file IDs
 *
 * URL selection: All patterns use contentUrl for direct file access
 *
 * Performance optimizations:
 * - Early exit if no file IDs detected
 * - Single-pass replacement using combined regex
 * - Efficient for large documents (O(n) instead of O(3n))
 *
 * @param content - Markdown content to process
 * @param contentUrlMap - Map of fileId to content URL (primary)
 * @param shareUrlMap - Map of fileId to share URL (fallback)
 * @returns Processed content
 */
export function replaceAllMarkdownFileIds(
  content: string,
  contentUrlMap: Map<string, string>,
  shareUrlMap: Map<string, string>,
): string {
  // Early exit: skip processing if no file IDs or empty maps
  if (!content || (contentUrlMap.size === 0 && shareUrlMap.size === 0)) {
    return content;
  }

  // Quick check: skip if no potential file ID patterns
  if (
    !hasFileIds(content) &&
    !content.includes('file-content://') &&
    !content.includes('file://')
  ) {
    return content;
  }

  // Single-pass replacement
  return content.replace(
    MARKDOWN_COMBINED_PATTERN,
    (
      match,
      fileContentId?: string,
      fileShareId?: string,
      markdownId?: string,
      jsStringQuoteStart?: string,
      jsStringFileId?: string,
      jsStringQuoteEnd?: string,
    ) => {
      // file-content://df-xxx → contentUrl
      if (fileContentId) {
        return contentUrlMap.get(fileContentId) ?? shareUrlMap.get(fileContentId) ?? match;
      }
      // file://df-xxx → contentUrl (for direct file access)
      if (fileShareId) {
        return contentUrlMap.get(fileShareId) ?? shareUrlMap.get(fileShareId) ?? match;
      }
      // ](df-xxx) → ](contentUrl) with shareUrl fallback
      if (markdownId) {
        const url = contentUrlMap.get(markdownId) ?? shareUrlMap.get(markdownId);
        return url ? `](${url})` : match;
      }
      // "df-xxx" or 'df-xxx' → quoted contentUrl (for JS string contexts)
      if (jsStringFileId && jsStringQuoteStart && jsStringQuoteEnd) {
        const url = contentUrlMap.get(jsStringFileId) ?? shareUrlMap.get(jsStringFileId);
        return url ? `${jsStringQuoteStart}${url}${jsStringQuoteEnd}` : match;
      }
      return match;
    },
  );
}

/**
 * Replace all file ID patterns in HTML content with URLs (optimized single-pass)
 * Handles: file-content://, file://, bare file IDs in src/href attributes, and JS string file IDs
 *
 * URL selection logic:
 * - href attributes: always use shareUrl (for navigation to share page)
 * - everything else (src, standalone URIs, JS strings): use contentUrl (for direct access)
 *
 * @param content - HTML content to process
 * @param contentUrlMap - Map of fileId to content URL (for src attributes, media playback)
 * @param shareUrlMap - Map of fileId to share URL (for href attributes, link navigation)
 * @returns Processed content
 */
export function replaceAllHtmlFileIds(
  content: string,
  contentUrlMap: Map<string, string>,
  shareUrlMap: Map<string, string>,
): string {
  if (!content || (contentUrlMap.size === 0 && shareUrlMap.size === 0)) {
    return content;
  }

  if (
    !hasFileIds(content) &&
    !content.includes('file-content://') &&
    !content.includes('file://')
  ) {
    return content;
  }

  return content.replace(
    HTML_COMBINED_PATTERN,
    (
      match,
      attrWithUriPrefix?: string,
      attrWithUriFileId?: string,
      attrWithUriSuffix?: string,
      fileContentId?: string,
      fileShareId?: string,
      bareAttrPrefix?: string,
      bareAttrFileId?: string,
      bareAttrSuffix?: string,
      jsStringQuoteStart?: string,
      jsStringFileId?: string,
      jsStringQuoteEnd?: string,
    ) => {
      // Pattern 1: Attribute with URI (src="file://..." or href="file://...")
      if (attrWithUriFileId && attrWithUriPrefix && attrWithUriSuffix) {
        const isHrefAttr = attrWithUriPrefix.toLowerCase().startsWith('href=');
        const primaryMap = isHrefAttr ? shareUrlMap : contentUrlMap;
        const fallbackMap = isHrefAttr ? contentUrlMap : shareUrlMap;
        const url = primaryMap.get(attrWithUriFileId) ?? fallbackMap.get(attrWithUriFileId);
        return url ? `${attrWithUriPrefix}${url}${attrWithUriSuffix}` : match;
      }

      // Pattern 4: Bare attribute (src="df-xxx" or href="df-xxx")
      if (bareAttrFileId && bareAttrPrefix && bareAttrSuffix) {
        const isHrefAttr = bareAttrPrefix.toLowerCase().startsWith('href=');
        const primaryMap = isHrefAttr ? shareUrlMap : contentUrlMap;
        const fallbackMap = isHrefAttr ? contentUrlMap : shareUrlMap;
        const url = primaryMap.get(bareAttrFileId) ?? fallbackMap.get(bareAttrFileId);
        return url ? `${bareAttrPrefix}${url}${bareAttrSuffix}` : match;
      }

      // Pattern 2 & 3: Standalone file-content:// or file:// → contentUrl
      const standaloneId = fileContentId ?? fileShareId;
      if (standaloneId) {
        const url = contentUrlMap.get(standaloneId) ?? shareUrlMap.get(standaloneId);
        return url ?? match;
      }

      // Pattern 5: JS string file ID ("df-xxx" or 'df-xxx') → quoted contentUrl
      // This handles patterns like: fileId: "df-xxx" in JavaScript code
      if (jsStringFileId && jsStringQuoteStart && jsStringQuoteEnd) {
        const url = contentUrlMap.get(jsStringFileId) ?? shareUrlMap.get(jsStringFileId);
        return url ? `${jsStringQuoteStart}${url}${jsStringQuoteEnd}` : match;
      }

      return match;
    },
  );
}
