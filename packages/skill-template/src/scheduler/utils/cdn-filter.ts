import { BaseSkill, SkillRunnableConfig } from '../../base';
import { extractStructuredData } from './extractor';
import { z } from 'zod';

// Common CDN and static resource patterns
const CDN_PATTERNS = [
  // CDN providers
  'cloudflare',
  'cloudfront',
  'akamai',
  'fastly',
  'cdnjs',
  'jsdelivr',
  'unpkg',
  'bootstrapcdn',
  'jquery',
  'googleapis',
  'googleusercontent',
  'amazonaws',
  'azureedge',
  'cloudinary',
  'imgix',
  'imgbb',
  'imgur',
  'gravatar',
  'githubusercontent',
  'raw.githubusercontent',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'bootstrapcdn.com',
  'jquery.com',
  'googleapis.com',
  'googleusercontent.com',
  'amazonaws.com',
  'azureedge.net',
  'cloudinary.com',
  'imgix.net',
  'imgbb.com',
  'imgur.com',
  'gravatar.com',
  'githubusercontent.com',
  'raw.githubusercontent.com',
];

// File extensions that are typically static resources
const STATIC_FILE_EXTENSIONS = [
  '.js',
  '.css',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.webm',
  '.webp',
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.csv',
  '.tsv',
  '.txt',
  '.md',
  '.markdown',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
];

// Define a TypeScript interface for URL analysis result
interface UrlAnalysisResult {
  url: string;
  isStaticResource: boolean;
  reason: string;
}

// Updated Schema for batch LLM analysis
const cdnBatchAnalysisSchema = z.object({
  results: z
    .array(
      z.object({
        url: z.string().describe('The URL being analyzed'),
        isStaticResource: z.boolean().describe('Whether the URL is a static resource or CDN link'),
        reason: z
          .string()
          .describe('Brief explanation of why the URL is or is not considered a static resource'),
      }),
    )
    .describe('Analysis results for each URL in the batch'),
});

/**
 * Programmatically check if a URL is likely a CDN or static resource
 * @param url URL to check
 * @param logger Optional logger for debugging
 * @returns boolean indicating if URL is likely a static resource
 */
export function isLikelyStaticResource(url: string, logger?: any): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    // Check against CDN patterns
    const cdnMatch = CDN_PATTERNS.find((pattern) => hostname.includes(pattern));
    if (cdnMatch) {
      if (logger) {
        logger.info(`URL ${url} matched CDN pattern: ${cdnMatch}`);
      }
      return true;
    }

    // Check file extensions
    const extensionMatch = STATIC_FILE_EXTENSIONS.find((ext) => pathname.endsWith(ext));
    if (extensionMatch) {
      if (logger) {
        logger.info(`URL ${url} matched static file extension: ${extensionMatch}`);
      }
      return true;
    }

    // Check common static resource paths
    const staticPaths = ['/assets/', '/static/', '/images/', '/img/', '/css/', '/js/', '/fonts/'];
    const pathMatch = staticPaths.find((path) => pathname.includes(path));
    if (pathMatch) {
      if (logger) {
        logger.info(`URL ${url} matched static resource path: ${pathMatch}`);
      }
      return true;
    }

    return false;
  } catch (_error) {
    // If URL parsing fails, consider it as a potential static resource
    if (logger) {
      logger.warn(`Failed to parse URL ${url}, treating as potential static resource`);
    }
    return true;
  }
}

/**
 * Use LLM to analyze multiple URLs at once to determine if they are static resources
 * @param urls URLs to analyze
 * @param ctx Context object containing configuration and engine
 * @returns Promise resolving to an array of analysis results
 */
export async function analyzeUrlsWithLLM(
  urls: string[],
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<UrlAnalysisResult[]> {
  if (!urls || urls.length === 0) {
    return [];
  }

  const logger = ctx.ctxThis.engine.logger;

  // Limit number of URLs in a single LLM call to avoid context length issues
  const MAX_URLS_PER_BATCH = 20;

  if (urls.length > MAX_URLS_PER_BATCH) {
    logger.info(`Too many URLs (${urls.length}), splitting into batches of ${MAX_URLS_PER_BATCH}`);

    // Split URLs into batches and process each batch
    const batches = [];
    for (let i = 0; i < urls.length; i += MAX_URLS_PER_BATCH) {
      batches.push(urls.slice(i, i + MAX_URLS_PER_BATCH));
    }

    // Process each batch and combine results
    let allResults: UrlAnalysisResult[] = [];
    for (let i = 0; i < batches.length; i++) {
      logger.info(`Processing URL batch ${i + 1}/${batches.length}`);
      const batchResults = await analyzeUrlsWithLLM(batches[i], ctx);
      allResults = [...allResults, ...batchResults];
    }

    return allResults;
  }

  logger.info(`Analyzing ${urls.length} URLs with LLM in a single batch`);

  const systemPrompt = `You are an AI URL analyzer that identifies static resources and CDN links.

## Core Principles
1. Identify static resources:
   - JavaScript files (.js)
   - CSS files (.css)
   - Images (.jpg, .png, .gif, etc.)
   - Fonts (.woff, .ttf, etc.)
   - Media files (.mp3, .mp4, etc.)
   - Documents (.pdf, .doc, etc.)
   - Archives (.zip, .tar, etc.)
   - Data files (.json, .xml, etc.)

2. Identify CDN links:
   - Cloudflare
   - Amazon CloudFront
   - Akamai
   - Fastly
   - jsDelivr
   - unpkg
   - Bootstrap CDN
   - Google CDN
   - Microsoft Azure CDN
   - Cloudinary
   - Image hosting services (imgix, imgbb, imgur)
   - GitHub raw content
   - Other common CDN providers

3. Analysis Rules:
   - Check file extensions
   - Look for CDN provider domains
   - Identify common static resource paths
   - Consider URL patterns typical of static resources

4. When to mark as static:
   - URL contains known CDN domains
   - URL ends with static file extensions
   - URL follows common static resource patterns
   - URL is from known image/media hosting services

5. When NOT to mark as static:
   - URL is a main webpage
   - URL contains dynamic content
   - URL is an API endpoint
   - URL is a documentation page
   - URL is a blog post or article

6. Analysis Format:
   - For each URL, provide a boolean indicating if it's a static resource
   - Include a brief explanation for each decision`;

  const urlsJson = JSON.stringify(urls, null, 2);
  const userMessage = `Please analyze this array of URLs and determine which ones are static resources or CDN links.
For each URL, provide a boolean determination and a brief explanation.

URLs to analyze:
${urlsJson}

Return a structured JSON array with your analysis for each URL.`;

  try {
    const model = ctx.ctxThis.engine.chatModel({ temperature: 0.1 }, 'queryAnalysis');
    const result = await extractStructuredData(
      model,
      cdnBatchAnalysisSchema,
      `${systemPrompt}\n\n${userMessage}`,
      ctx.config,
      3,
      ctx?.config?.configurable?.modelConfigMap?.queryAnalysis,
    );

    logger.info(`LLM batch analysis complete: analyzed ${result.results.length} URLs`);

    return result.results as UrlAnalysisResult[];
  } catch (error) {
    logger.error(`Failed to analyze URLs batch with LLM: ${error}`);
    // Fallback to simple programmatic check for all URLs
    return urls.map((url) => ({
      url,
      isStaticResource: isLikelyStaticResource(url, logger),
      reason: 'Determined by fallback programmatic check due to LLM error',
    }));
  }
}

/**
 * Filter out static resources and CDN links from an array of URLs
 * @param urls Array of URLs to filter
 * @param ctx Context object containing configuration and engine
 * @returns Promise resolving to filtered array of URLs
 */
export async function filterStaticResources(
  urls: string[],
  ctx: { config: SkillRunnableConfig; ctxThis: BaseSkill },
): Promise<string[]> {
  if (!urls?.length) {
    return [];
  }

  const logger = ctx.ctxThis.engine.logger;
  logger.info(`Starting to filter ${urls.length} URLs for static resources and CDN links`);

  // First pass: Quick programmatic filter
  const programmaticFilterResults = urls.map((url) => {
    const isStatic = isLikelyStaticResource(url, logger);
    return { url, isStatic };
  });

  // Count URLs filtered by programmatic check
  const programmaticFilteredCount = programmaticFilterResults.filter(
    (result) => result.isStatic,
  ).length;
  logger.info(`Programmatically identified ${programmaticFilteredCount} static resources`);

  // Get URLs that need LLM verification (passed programmatic filter)
  const needLlmVerification = programmaticFilterResults
    .filter((result) => !result.isStatic)
    .map((result) => result.url);

  if (!needLlmVerification.length) {
    logger.info('No URLs need LLM verification, all were filtered programmatically');
    return [];
  }

  // Only perform LLM verification if there are URLs that need it
  if (needLlmVerification.length > 0) {
    logger.info(`${needLlmVerification.length} URLs need LLM verification`);

    // Second pass: LLM verification for remaining URLs - now in a single batch
    const llmResults = await analyzeUrlsWithLLM(needLlmVerification, ctx);

    // Filter URLs that passed both programmatic and LLM checks
    const filteredUrls = llmResults
      .filter((result) => !result.isStaticResource)
      .map((result) => result.url);

    // Log detailed statistics
    const llmFilteredCount = needLlmVerification.length - filteredUrls.length;
    logger.info(`LLM identified ${llmFilteredCount} additional static resources`);
    logger.info(
      `Filtering complete: ${urls.length} total URLs, ${programmaticFilteredCount + llmFilteredCount} filtered out, ${filteredUrls.length} remain`,
    );

    // Log some examples of categorization if available
    if (llmResults.length > 0) {
      const staticExample = llmResults.find((r) => r.isStaticResource && r.url && r.reason);
      const nonStaticExample = llmResults.find((r) => !r.isStaticResource && r.url && r.reason);

      if (staticExample) {
        logger.info(
          `Example static resource: ${staticExample.url}, Reason: ${staticExample.reason}`,
        );
      }

      if (nonStaticExample) {
        logger.info(
          `Example non-static resource: ${nonStaticExample.url}, Reason: ${nonStaticExample.reason}`,
        );
      }
    }

    return filteredUrls;
  }

  // This should not be reached but provides a fallback
  return needLlmVerification;
}
