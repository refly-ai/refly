import { Source } from '@refly/openapi-schema';
import { BaseSkill, SkillRunnableConfig } from '../base';
import { crawlExtractedUrls } from '../scheduler/utils/extract-weblink';
import { isValidUrl } from '@refly/utils';

/**
 * Processes URLs from the frontend context and returns sources.
 *
 * @param contextUrls - Array of URL objects from the frontend context
 * @param config - The skill configuration
 * @param skill - The skill instance for logging and engine access
 * @param options - Options for URL crawling (concurrencyLimit and batchSize)
 * @returns Array of Source objects from the processed URLs
 */
export const processContextUrls = async (
  contextUrls: Array<{ url: string }>,
  config: SkillRunnableConfig,
  skill: BaseSkill,
  options = { concurrencyLimit: 5, batchSize: 8 },
): Promise<Source[]> => {
  let contextUrlSources: Source[] = [];

  if (contextUrls?.length > 0) {
    const urls = contextUrls.map((item) => item?.url).filter((url) => url && isValidUrl(url));

    if (urls.length > 0) {
      skill.engine.logger.log(`Processing ${urls.length} URLs from context`);

      contextUrlSources = await crawlExtractedUrls(urls, config, skill, {
        concurrencyLimit: options.concurrencyLimit,
        batchSize: options.batchSize,
      });

      skill.engine.logger.log(`Processed context URL sources count: ${contextUrlSources.length}`);
    }
  }

  return contextUrlSources;
};
