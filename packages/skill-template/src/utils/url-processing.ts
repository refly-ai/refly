import { Source } from '@refly/openapi-schema';
import { SkillRunnableConfig, BaseSkill } from '../base';
import { isValidUrl } from '@refly/utils';

/**
 * Process URLs from frontend context
 * This function processes URLs provided in the context and converts them to sources
 *
 * @param contextUrls Array of URL objects from the context
 * @param config Skill configuration
 * @param skillInstance The skill instance
 * @returns Array of Source objects
 */
export async function processContextUrls(
  contextUrls: Array<{ url: string; title?: string }>,
  config: SkillRunnableConfig,
  skillInstance: BaseSkill,
): Promise<Source[]> {
  if (!contextUrls || contextUrls.length === 0) {
    return [];
  }

  // Filter to valid URLs only
  const validUrls = contextUrls
    .filter((item) => item.url && isValidUrl(item.url))
    .map((item) => ({
      url: item.url,
      title: item.title || item.url,
    }));

  if (validUrls.length === 0) {
    return [];
  }

  // Batch process URLs concurrently with limits
  const sources: Source[] = [];
  const concurrencyLimit = 5;

  // Process in batches to limit concurrency
  for (let i = 0; i < validUrls.length; i += concurrencyLimit) {
    const batch = validUrls.slice(i, i + concurrencyLimit);

    const batchResults = await Promise.all(
      batch.map(async ({ url, title }) => {
        try {
          // Try to crawl URL content using engine service if available
          if (skillInstance.engine?.service?.crawlUrl) {
            const result = await skillInstance.engine.service.crawlUrl(
              config.configurable.user,
              url,
            );

            if (result?.content) {
              return {
                title: result.title || title || url,
                url,
                content: result.content,
                pageContent: result.content,
                type: 'url' as const,
              };
            }
          }

          // Fallback: Create a source just with the URL reference
          return {
            title: title || url,
            url,
            content: `Content from URL: ${url}`,
            pageContent: `Content from URL: ${url}`,
            type: 'url' as const,
          };
        } catch (error) {
          skillInstance.engine?.logger?.warn(`Failed to process URL ${url}: ${error}`);
          return null;
        }
      }),
    );

    // Add valid results to sources
    sources.push(...batchResults.filter(Boolean));
  }

  return sources;
}

/**
 * Extract base domain from URL
 *
 * @param url The URL to process
 * @returns The base domain
 */
export function extractBaseDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    // Error is not used, so we don't need to capture it
    return url;
  }
}

/**
 * Normalize URL for comparison
 *
 * @param url The URL to normalize
 * @returns Normalized URL
 */
export function normalizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    let normalized = `${parsedUrl.hostname}${parsedUrl.pathname}`;

    // Remove trailing slash
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    // Convert to lowercase
    return normalized.toLowerCase();
  } catch {
    // Error is not used, so we don't need to capture it
    return url.toLowerCase();
  }
}
