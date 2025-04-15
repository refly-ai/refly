import { SkillRunnableConfig } from '../../base';
import { Source } from '@refly-packages/openapi-schema';
import { BaseSkill } from '../../base';
import pLimit from 'p-limit';
import { isValidUrl, extractUrlsWithLinkify } from '@refly-packages/utils';
import { filterStaticResources } from './cdn-filter';

// Default concurrency limit and batch size
const DEFAULT_CONCURRENCY_LIMIT = 5;
const DEFAULT_BATCH_SIZE = 8;

// Helper to chunk array into batches
const chunk = <T>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
};

/**
 * Crawl a single URL and format it as a source
 * @param url URL string to crawl
 * @param user User for the crawl request
 * @param engine SkillEngine with access to crawl service
 * @param logger Logger for reporting progress
 * @returns Source object with content from the URL or null on failure
 */
async function crawlSingleUrl(
  url: string,
  user: any,
  engine: any,
  logger: any,
): Promise<Source | null> {
  try {
    // Verify URL is valid using Node.js URL API
    if (!isValidUrl(url)) {
      logger.warn(`Skipping invalid URL: ${url}`);
      return null;
    }

    const result = await engine.service.crawlUrl(user, url);

    if (result?.content) {
      return {
        pageContent: result.content,
        metadata: {
          source: url,
          title: result.title || url,
          // Use type assertion to allow custom properties
          ...(result.metadata || {}),
        } as any,
        url,
        title: result.title || url,
      };
    }

    if (logger) {
      logger.warn(`URL crawled but no content returned: ${url}`);
    }
    return null;
  } catch (error) {
    if (logger) {
      logger.error(`Failed to crawl URL ${url}: ${error}`);
    }
    return null;
  }
}

/**
 * Crawl URLs extracted from a query and format them as sources
 * @param urls Array of URLs to crawl
 * @param config The skill runnable configuration
 * @param skill The BaseSkill instance with access to the engine
 * @param options Optional configuration for concurrency and batch size
 * @returns Array of sources with content from the URLs
 */
export async function crawlExtractedUrls(
  urls: string[],
  config: SkillRunnableConfig,
  skill: BaseSkill,
  options?: {
    concurrencyLimit?: number;
    batchSize?: number;
    skipCdnFilter?: boolean;
  },
): Promise<Source[]> {
  if (!urls || urls.length === 0) {
    return [];
  }

  const { user, runtimeConfig } = config.configurable;
  const { skipCdnFilter = false } = options || {};

  if (runtimeConfig?.disableLinkParsing) {
    return [];
  }

  const engine = skill.engine;
  const logger = engine.logger;

  if (!engine || !engine.service || !engine.service.crawlUrl) {
    if (logger) {
      logger.error('Crawl URL service not available');
    }
    return [];
  }

  // Set up concurrency control
  const concurrencyLimit = options?.concurrencyLimit || DEFAULT_CONCURRENCY_LIMIT;
  const limit = pLimit(concurrencyLimit);

  // Filter out invalid URLs
  const validUrls = urls.filter((url) => isValidUrl(url));
  if (validUrls.length < urls.length) {
    logger.warn(`Filtered out ${urls.length - validUrls.length} invalid URLs`);
  }

  // Filter out static resources and CDN links unless explicitly skipped
  let filteredUrls = validUrls;
  if (!skipCdnFilter) {
    logger.log(`Filtering out static resources and CDN links from ${validUrls.length} URLs`);
    filteredUrls = await filterStaticResources(validUrls, { config, ctxThis: skill });
    if (filteredUrls.length < validUrls.length) {
      logger.log(
        `${validUrls.length - filteredUrls.length} static resource URLs filtered out, ${filteredUrls.length} URLs remaining`,
      );
    }
  }

  // Split URLs into batches for processing
  const batchSize = options?.batchSize || DEFAULT_BATCH_SIZE;
  const batches = chunk(filteredUrls, batchSize);

  logger.log(
    `Starting to crawl ${filteredUrls.length} URLs with concurrency limit of ${concurrencyLimit} in ${batches.length} batches`,
  );

  const sources: Source[] = [];

  // Process each batch sequentially
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    logger.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} URLs`);

    // Process URLs in each batch concurrently
    const batchResults = await Promise.all(
      batch.map((url) => limit(() => crawlSingleUrl(url, user, engine, logger))),
    );

    // Filter out failed crawls and add to sources
    const validResults = batchResults.filter(Boolean) as Source[];
    sources.push(...validResults);

    logger.log(
      `Completed batch ${i + 1}/${batches.length}: ${validResults.length}/${batch.length} URLs successfully crawled`,
    );
  }

  return sources;
}

/**
 * Extract URLs from a query, crawl them, and return as sources
 * Uses linkify-it for efficient URL extraction without AI
 * @param query The user's query text
 * @param config The skill runnable configuration
 * @param skill The BaseSkill instance
 * @param options Optional configuration for concurrency and batch size
 * @returns Array of sources with content from the URLs
 */
export async function extractAndCrawlUrls(
  query: string,
  config: SkillRunnableConfig,
  skill: BaseSkill,
  options?: {
    concurrencyLimit?: number;
    batchSize?: number;
    skipCdnFilter?: boolean;
  },
): Promise<{
  sources: Source[];
  analysis: { hasUrls: boolean; queryIntent: string };
}> {
  const logger = skill.engine.logger;
  const disableLinkParsing = config?.configurable?.runtimeConfig?.disableLinkParsing;

  if (disableLinkParsing !== false) {
    logger.log('disableLinkParsing is on');
    return {
      sources: [],
      analysis: {
        hasUrls: false,
        queryIntent: query,
      },
    };
  }

  // Use linkify-it for fast and reliable URL extraction
  const { hasUrls, detectedUrls } = extractUrlsWithLinkify(query);

  if (!hasUrls) {
    // If no URLs detected, return empty result
    logger.log('No URLs detected with linkify-it');
    return {
      sources: [],
      analysis: {
        hasUrls: false,
        queryIntent: query,
      },
    };
  }

  logger.log(
    `Detected ${detectedUrls.length} URLs with linkify-it: ${JSON.stringify(detectedUrls)}`,
  );

  // Crawl the extracted URLs
  const sources = await crawlExtractedUrls(detectedUrls, config, skill, options);

  return {
    sources,
    analysis: {
      hasUrls: Boolean(sources.length),
      queryIntent: query, // Use query directly as intent
    },
  };
}
