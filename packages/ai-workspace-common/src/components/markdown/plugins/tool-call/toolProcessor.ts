import { ToolCallStatus } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/types';
import { ToolCallResult } from '@refly/openapi-schema';

// Define the tool use and tool result tags directly here to avoid circular dependencies
export const TOOL_USE_TAG = 'tool_use';
export const TOOL_USE_TAG_RENDER = 'reflyToolUse';

// Pre-compiled regular expressions for better performance
const TOOL_USE_REGEX = new RegExp(`<${TOOL_USE_TAG}[^>]*>([\\s\\S]*?)</${TOOL_USE_TAG}>`, 'i');
const CALL_ID_REGEX = /<callId>([\s\S]*?)<\/callId>/i;
const NAME_REGEX = /<name>([\s\S]*?)<\/name>/i;
const TYPE_REGEX = /<type>([\s\S]*?)<\/type>/i;
const TOOL_CALL_STATUS_REGEX = /<status>([\s\S]*?)<\/status>/i;
const CREATED_AT_REGEX = /<createdAt>([\s\S]*?)<\/createdAt>/i;
const UPDATED_AT_REGEX = /<updatedAt>([\s\S]*?)<\/updatedAt>/i;
const TOOLSET_KEY_REGEX = /<toolsetKey>([\s\S]*?)<\/toolsetKey>/i;
const TOOLSET_NAME_REGEX = /<toolsetName>([\s\S]*?)<\/toolsetName>/i;
const ARGUMENTS_REGEX = /<arguments>([\s\S]*?)<\/arguments>/i;
const RESULT_REGEX = /<result>([\s\S]*?)<\/result>/i;
const ERROR_REGEX = /<error>([\s\S]*?)<\/error>/i;

// Media URL patterns with named groups for efficient extraction
const MEDIA_PATTERNS = {
  BASE64_IMAGE:
    /data:image\/(?<format>png|jpeg|gif|webp|svg\+xml);base64,(?<data>[A-Za-z0-9+\/=]+)/i,
  HTTP_IMAGE: /https?:\/\/[^\s"'<>]+\.(?<format>png|jpeg|jpg|gif|webp|svg)[^\s"'<>]*/i,
  HTTP_AUDIO: /https?:\/\/[^\s"'<>]+\.(?<format>mp3|wav|ogg|flac|m4a|aac)[^\s"'<>]*/i,
  HTTP_VIDEO: /https?:\/\/[^\s"'<>]+\.(?<format>mp4|webm|avi|mov|wmv|flv|mkv|m4v)[^\s"'<>]*/i,
} as const;

// URL encoding mappings for efficient decoding
const URL_DECODE_MAPPINGS = [
  [/%5C%22/g, '\\"'],
  [/%5Cn/g, '\\n'],
  [/%5Cr/g, '\\r'],
  [/%5Ct/g, '\\t'],
  [/%2C/g, ','],
  [/%5C/g, '\\'],
] as const;

/**
 * Utility function to safely extract content from regex matches
 * Uses a cache to avoid re-executing the same regex on the same content
 */
const extractionCache = new Map<string, string>();

const safeExtract = (content: string, regex: RegExp): string => {
  const cacheKey = `${regex.source}::${content}`;

  if (extractionCache.has(cacheKey)) {
    return extractionCache.get(cacheKey)!;
  }

  const match = regex.exec(content);
  const result = match?.[1]?.trim() ?? '';

  // Cache the result for future use
  extractionCache.set(cacheKey, result);

  return result;
};

/**
 * Decode URL that may have been encoded by remarkGfm
 * Optimized with pre-defined mappings for better performance
 */
const decodeUrlFromRemarkGfm = (url: string): string => {
  let decodedUrl = url;
  for (const [pattern, replacement] of URL_DECODE_MAPPINGS) {
    decodedUrl = decodedUrl.replace(pattern, replacement);
  }

  try {
    // Then try standard URL decoding for any remaining encoded characters
    return decodeURIComponent(decodedUrl);
  } catch {
    // If decoding fails, return the URL with replacements only
    return decodedUrl;
  }
};

/**
 * Extract URLs from HTML elements (for content processed by remarkGfm)
 * @param element The HTML element to extract URLs from
 * @returns Array of found URLs
 */
const extractUrlsFromHtmlElements = (element: any): string[] => {
  const urls: string[] = [];

  if (element?.type === 'element' && element?.tagName === 'a' && element?.properties?.href) {
    // Decode the URL in case it was encoded by remarkGfm
    const decodedUrl = decodeUrlFromRemarkGfm(element.properties.href);
    urls.push(decodedUrl);
  }

  if (element?.children) {
    for (const child of element.children) {
      urls.push(...extractUrlsFromHtmlElements(child));
    }
  }

  return urls;
};

/**
 * Media types for unified processing
 */
type MediaType = 'image' | 'audio' | 'video';

interface MediaExtractionResult {
  url: string | undefined;
  format: string | undefined;
  isHttp: boolean;
  isBase64?: boolean;
}

/**
 * Unified media URL extraction function
 * Extracts image, audio, or video URLs from strings and HTML elements
 */
const extractMediaUrl = (
  str: string,
  mediaType: MediaType,
  htmlElements?: any[],
): MediaExtractionResult => {
  // First check HTML elements if provided (for remarkGfm processed content)
  if (htmlElements && mediaType === 'image') {
    for (const element of htmlElements) {
      const urls = extractUrlsFromHtmlElements(element);
      for (const url of urls) {
        const httpMatch = MEDIA_PATTERNS.HTTP_IMAGE.exec(url);
        if (httpMatch?.groups && httpMatch[0]) {
          return {
            url: httpMatch[0],
            format: httpMatch.groups.format,
            isHttp: true,
            isBase64: false,
          };
        }
      }
    }
  }

  // Check for base64 image URL (only for images)
  if (mediaType === 'image') {
    const base64Match = MEDIA_PATTERNS.BASE64_IMAGE.exec(str);
    if (base64Match?.groups && base64Match[0]) {
      return {
        url: base64Match[0],
        format: base64Match.groups.format,
        isHttp: false,
        isBase64: true,
      };
    }
  }

  // Check for HTTP URLs based on media type
  const pattern =
    mediaType === 'image'
      ? MEDIA_PATTERNS.HTTP_IMAGE
      : mediaType === 'audio'
        ? MEDIA_PATTERNS.HTTP_AUDIO
        : MEDIA_PATTERNS.HTTP_VIDEO;

  const httpMatch = pattern.exec(str);
  if (httpMatch?.groups && httpMatch[0]) {
    return {
      url: httpMatch[0],
      format: httpMatch.groups.format,
      isHttp: true,
      isBase64: false,
    };
  }

  return { url: undefined, format: undefined, isHttp: false, isBase64: false };
};

/**
 * Parse JSON safely with caching to avoid repeated parsing
 */
const jsonParseCache = new Map<string, any>();

const safeJsonParse = (jsonStr: string): any => {
  if (jsonParseCache.has(jsonStr)) {
    return jsonParseCache.get(jsonStr);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    jsonParseCache.set(jsonStr, parsed);
    return parsed;
  } catch {
    jsonParseCache.set(jsonStr, null);
    return null;
  }
};

/**
 * Extract media attributes for all media types at once
 */
const extractAllMediaAttributes = (
  resultStr: string,
  argsStr: string,
  linkElements?: any[],
): Record<string, string> => {
  const attributes: Record<string, string> = {};

  // Extract all media URLs in parallel
  const imageResult = extractMediaUrl(resultStr, 'image', linkElements);
  const audioResult = extractMediaUrl(resultStr, 'audio');
  const videoResult = extractMediaUrl(resultStr, 'video');

  // If no direct matches found, try JSON parsing once for all media types
  if (!imageResult.url && !audioResult.url && !videoResult.url) {
    const resultObj = safeJsonParse(resultStr);
    if (resultObj) {
      const resultJsonStr = JSON.stringify(resultObj);
      const jsonImageResult = extractMediaUrl(resultJsonStr, 'image', linkElements);
      const jsonAudioResult = extractMediaUrl(resultJsonStr, 'audio');
      const jsonVideoResult = extractMediaUrl(resultJsonStr, 'video');

      // Process JSON results
      if (jsonImageResult.url) Object.assign(imageResult, jsonImageResult);
      if (jsonAudioResult.url) Object.assign(audioResult, jsonAudioResult);
      if (jsonVideoResult.url) Object.assign(videoResult, jsonVideoResult);
    }
  }

  // Extract name from arguments once for all media types
  let mediaNameFromArgs = '';
  if (argsStr) {
    const argsObj = safeJsonParse(argsStr);
    if (argsObj) {
      if (typeof argsObj.params === 'string') {
        const paramsObj = safeJsonParse(argsObj.params);
        if (paramsObj?.name && typeof paramsObj.name === 'string') {
          mediaNameFromArgs = paramsObj.name.trim();
        }
      } else if (argsObj.name && typeof argsObj.name === 'string') {
        mediaNameFromArgs = argsObj.name.trim();
      }
    }
  }

  // Process image attributes
  if (imageResult.url && imageResult.format) {
    if (imageResult.isHttp) {
      attributes['data-tool-image-http-url'] = imageResult.url;
    } else {
      attributes['data-tool-image-base64-url'] = imageResult.url;
    }
    const imageName = mediaNameFromArgs || 'image';
    attributes['data-tool-image-name'] = `${imageName}.${imageResult.format}`;
  }

  // Process audio attributes
  if (audioResult.url && audioResult.format) {
    attributes['data-tool-audio-http-url'] = audioResult.url;
    const audioName = mediaNameFromArgs || 'audio';
    attributes['data-tool-audio-name'] = `${audioName}.${audioResult.format}`;
    attributes['data-tool-audio-format'] = audioResult.format;
  }

  // Process video attributes
  if (videoResult.url && videoResult.format) {
    attributes['data-tool-video-http-url'] = videoResult.url;
    const videoName = mediaNameFromArgs || 'video';
    attributes['data-tool-video-name'] = `${videoName}.${videoResult.format}`;
    attributes['data-tool-video-format'] = videoResult.format;
  }

  return attributes;
};

/**
 * Extract tool attributes from content string
 */
export const extractToolAttributes = (
  content: string,
  linkElements?: any[],
): Record<string, string> => {
  const attributes: Record<string, string> = {};

  // Extract callId for linking with SSE tool_call_event
  const callId = safeExtract(content, CALL_ID_REGEX);
  if (callId) attributes['data-tool-call-id'] = callId;

  // Extract basic tool information
  const toolName = safeExtract(content, NAME_REGEX);
  if (toolName) attributes['data-tool-name'] = toolName;

  const toolType = safeExtract(content, TYPE_REGEX);
  if (toolType) attributes['data-tool-type'] = toolType;

  const toolsetKey = safeExtract(content, TOOLSET_KEY_REGEX);
  if (toolsetKey) attributes['data-tool-toolset-key'] = toolsetKey;

  const toolsetName = safeExtract(content, TOOLSET_NAME_REGEX);
  if (toolsetName) attributes['data-tool-toolset-name'] = toolsetName;

  const argsStr = safeExtract(content, ARGUMENTS_REGEX);
  if (argsStr) attributes['data-tool-arguments'] = argsStr;

  const resultStr = safeExtract(content, RESULT_REGEX);
  if (resultStr) {
    attributes['data-tool-result'] = resultStr;

    // Extract all media attributes at once
    const mediaAttributes = extractAllMediaAttributes(resultStr, argsStr, linkElements);
    Object.assign(attributes, mediaAttributes);
  }

  const toolCallStatus = safeExtract(content, TOOL_CALL_STATUS_REGEX);
  if (toolCallStatus) attributes['data-tool-call-status'] = toolCallStatus;

  const createdAt = safeExtract(content, CREATED_AT_REGEX);
  if (createdAt) attributes['data-tool-created-at'] = createdAt;

  const updatedAt = safeExtract(content, UPDATED_AT_REGEX);
  if (updatedAt) attributes['data-tool-updated-at'] = updatedAt;

  const errorStr = safeExtract(content, ERROR_REGEX);
  if (errorStr) attributes['data-tool-error'] = errorStr;

  return attributes;
};

/**
 * Check if text contains tool use tags
 */
export const hasToolUseTag = (text: string): boolean => {
  return text.includes(`<${TOOL_USE_TAG}`);
};

/**
 * Extract tool use content from text
 */
export const extractToolUseContent = (text: string): string | null => {
  const match = TOOL_USE_REGEX.exec(text);
  return match?.[1] ?? null;
};

/**
 * Get the full tool use match (including tags)
 */
export const getFullToolUseMatch = (text: string): string | null => {
  const match = TOOL_USE_REGEX.exec(text);
  return match?.[0] ?? null;
};

/**
 * Create a tool node element
 */
export const createToolNode = (attributes: Record<string, string>) => {
  return {
    type: 'element',
    tagName: TOOL_USE_TAG_RENDER,
    properties: attributes,
    children: [],
  };
};

/**
 * Split text by tool use match and create text nodes
 */
const splitTextByToolUse = (text: string, fullMatch: string, nodeType: 'text' | 'raw') => {
  const parts = text.split(fullMatch);
  const nodes = [];

  // Add text before the tool_use tag if it exists
  if (parts[0]) {
    nodes.push({
      type: nodeType,
      value: parts[0],
    });
  }

  // Add text after the tool_use tag if it exists
  if (parts[1]) {
    nodes.push({
      type: nodeType,
      value: parts[1],
    });
  }

  return nodes;
};

/**
 * Process tool use in text and return replacement nodes
 */
export const processToolUseInText = (
  text: string,
  linkElements: any[],
  nodeType: 'text' | 'raw' = 'text',
): { toolNode: any; textNodes: any[]; fullMatch: string } | null => {
  if (!hasToolUseTag(text)) {
    return null;
  }

  const content = extractToolUseContent(text);
  if (!content) {
    return null;
  }

  const fullMatch = getFullToolUseMatch(text);
  if (!fullMatch) {
    return null;
  }

  const attributes = extractToolAttributes(content, linkElements);
  const toolNode = createToolNode(attributes);
  const textNodes = splitTextByToolUse(text, fullMatch, nodeType);

  return { toolNode, textNodes, fullMatch };
};

/**
 * Parse a single tool_use XML block from the given chunk content into a normalized object.
 * Returns null if no valid tool_use is found.
 */
export const parseToolCallFromChunk = (
  content: string,
  stepName?: string,
): ToolCallResult | null => {
  if (!content || !hasToolUseTag(content)) {
    return null;
  }
  const inner = extractToolUseContent(content);
  if (!inner) {
    return null;
  }
  const attrs = extractToolAttributes(inner);
  const callId = attrs['data-tool-call-id'] ?? '';
  if (!callId) {
    return null;
  }

  // the status is always failed if the result is not present
  const status = (attrs['data-tool-call-status'] ?? ToolCallStatus.FAILED.toString()) as
    | 'executing'
    | 'completed'
    | 'failed';

  const toMs = (val?: string): number | undefined => {
    const n = Number(val ?? '');
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const createdAt = toMs(attrs['data-tool-created-at']) ?? Date.now();
  const updatedAt = toMs(attrs['data-tool-updated-at']) ?? Date.now();

  const safeParse = (str?: string): unknown => {
    if (!str) return undefined;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const argsStr = attrs['data-tool-arguments'];
  const resultStr = attrs['data-tool-result'];

  const parsed: ToolCallResult = {
    callId,
    status,
    createdAt,
    updatedAt,
    toolsetId: attrs['data-tool-toolset-key'] ?? undefined,
    toolName: attrs['data-tool-name'] ?? undefined,
    stepName,
    input: safeParse(argsStr) as Record<string, unknown> | undefined,
    output: safeParse(resultStr) as Record<string, unknown> | undefined,
    error: status === 'failed' ? String(resultStr ?? '') : undefined,
    uid: undefined,
  };

  return parsed;
};

/**
 * Merge a parsed tool call into an existing array by callId (idempotent update).
 */
export const mergeToolCallById = (
  existing: ToolCallResult[],
  next: ToolCallResult,
): ToolCallResult[] => {
  const list = Array.isArray(existing) ? [...existing] : [];
  const idx = list.findIndex((tc) => tc.callId === next.callId);
  if (idx === -1) {
    list.push(next);
    return list;
  }
  list[idx] = { ...list[idx], ...next };
  return list;
};
