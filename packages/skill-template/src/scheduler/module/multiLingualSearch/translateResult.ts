/**
 * 1. 实现新的 structed output 来支持翻译
 * 2. 如果 resultDisplayLocale 为 auto 则将 query 传入让 llm 识别 query 的语言 locale，然后将结果翻译为此 locale
 * 3. 如果非 auto，则将结果翻译为对应的 resultDisplayLocale
 */

import { z } from 'zod';
import { Source } from '@refly/openapi-schema';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import pLimit from 'p-limit';
import chunk from 'lodash/chunk';

// Schema for language detection
export const languageDetectionSchema = z
  .object({
    detectedLanguage: z.string().describe('The detected language of the query'),
    confidence: z.number().min(0).max(1).describe('Confidence score of language detection'),
    reasoning: z.string().describe('Explanation of why this language was detected'),
  })
  .describe('Language detection result for the query');

// Schema for translation results
export const translateResultsSchema = z
  .object({
    translations: z
      .array(
        z.object({
          title: z.string().describe('Translated title of the source'),
          snippet: z.string().describe('Translated content/snippet of the source'),
          originalUrl: z.string().describe('Original URL of the source (unchanged)'),
        }),
      )
      .describe('Array of translated sources'),
  })
  .describe('Translation results for search sources');

// System prompt for language detection
export const buildLanguageDetectionSystemPrompt = () => `
You are a language detection expert. Your task is to:
1. Analyze the given query
2. Determine the most likely language of the query
3. Provide a confidence score and reasoning for your detection

Consider:
- Language patterns and structures
- Character sets used
- Common phrases and expressions
- Technical terms and proper nouns
`;

// User prompt for language detection
export const buildLanguageDetectionUserPrompt = (query: string) => `
Please analyze the following query and detect its language:
"""
${query}
"""

Provide:
1. The detected language code (e.g., en, zh-CN, ja)
2. Your confidence in this detection (0-1)
3. Brief explanation of your reasoning
`;

// System prompt for result translation
export const buildTranslateResultsSystemPrompt = () => `
You are a multilingual search result translator. Your task is to:
1. Translate search result titles and snippets to the target language
2. Maintain search relevance and meaning
3. Preserve technical terms and proper nouns
4. Ensure natural language flow in the target language

Guidelines:
- Keep URLs unchanged
- Preserve formatting and special characters
- Maintain technical accuracy
- Adapt cultural references appropriately

Example Input:
{
  "sources": [
    {
      "url": "https://example.com/article",
      "title": "Should I ask for something in return for my kindness?",
      "pageContent": "The ethics of reciprocity in helping others..."
    }
  ],
  "targetLocale": "zh-CN"
}

Example Output:
{
  "translations": [
    {
      "originalUrl": "https://example.com/article",
      "title": "我应该为善举要求回报吗？",
      "snippet": "帮助他人时互惠互利的道德考量..."
    }
  ]
}
`;

// User prompt for result translation
export const buildTranslateResultsUserPrompt = ({
  sources,
  targetLocale,
}: {
  sources: Source[];
  targetLocale: string;
}) => `
Please translate the following search results to ${targetLocale}:

Sources to translate:
${JSON.stringify(sources, null, 2)}

Requirements:
1. Translate both titles and snippets
2. Keep URLs unchanged
3. Maintain search relevance
4. Preserve technical terms
`;

// Helper function to detect query language
export const detectQueryLanguage = async (query: string, model: any, config: any) => {
  const runnable = model.withStructuredOutput(languageDetectionSchema);

  return await runnable.invoke(
    [
      new SystemMessage(buildLanguageDetectionSystemPrompt()),
      new HumanMessage(buildLanguageDetectionUserPrompt(query)),
    ],
    config,
  );
};

interface TranslationBatchResult {
  translations: {
    title: string;
    snippet: string;
    originalUrl: string;
  }[];
}

// Modified system prompt to handle batch translation
export const buildTranslateResultsBatchSystemPrompt = () => `
You are a multilingual search result translator. Your task is to:
1. Translate a batch of search result titles and snippets to the target language
2. Maintain search relevance and meaning
3. Preserve technical terms and proper nouns
4. Ensure natural language flow in the target language

Guidelines:
- Keep URLs unchanged
- Preserve formatting and special characters
- Maintain technical accuracy
- Adapt cultural references appropriately
- Process all items in the batch while maintaining consistency

Example Input:
{
  "sources": [
    {
      "url": "https://example.com/article1",
      "title": "First article title",
      "pageContent": "First article content..."
    },
    {
      "url": "https://example.com/article2",
      "title": "Second article title",
      "pageContent": "Second article content..."
    }
  ],
  "targetLocale": "zh-CN"
}

Example Output:
{
  "translations": [
    {
      "originalUrl": "https://example.com/article1",
      "title": "第一篇文章标题",
      "snippet": "第一篇文章内容..."
    },
    {
      "originalUrl": "https://example.com/article2",
      "title": "第二篇文章标题",
      "snippet": "第二篇文章内容..."
    }
  ]
}
`;

// Modified user prompt for batch translation
export const buildTranslateResultsBatchUserPrompt = ({
  sources,
  targetLocale,
}: {
  sources: Source[];
  targetLocale: string;
}) => `
Please translate the following batch of search results to ${targetLocale}:

Sources to translate:
${JSON.stringify(sources, null, 2)}

Requirements:
1. Translate all titles and snippets in the batch
2. Keep URLs unchanged
3. Maintain search relevance
4. Preserve technical terms
5. Ensure consistency across translations
`;

// Helper function to translate a batch of results
const translateBatch = async ({
  sources,
  targetLocale,
  model,
  config,
}: {
  sources: Source[];
  targetLocale: string;
  model: any;
  config: any;
}): Promise<TranslationBatchResult> => {
  const runnable = model.withStructuredOutput(translateResultsSchema);

  return await runnable.invoke(
    [
      new SystemMessage(buildTranslateResultsBatchSystemPrompt()),
      new HumanMessage(
        buildTranslateResultsBatchUserPrompt({
          sources,
          targetLocale,
        }),
      ),
    ],
    config,
  );
};

// Main translation function with concurrency control
export const translateResults = async ({
  sources,
  targetLocale,
  model,
  config,
  concurrencyLimit = 3, // Default concurrent batch limit
  batchSize = 5, // Default items per batch
}: {
  sources: Source[];
  targetLocale: string;
  model: any;
  config: any;
  concurrencyLimit?: number;
  batchSize?: number;
}): Promise<TranslationBatchResult> => {
  // Create batches of sources
  const batches = chunk(sources, batchSize);

  // Initialize concurrency limiter
  const limit = pLimit(concurrencyLimit);

  // Create translation promises for each batch
  const translationPromises = batches.map((batchSources) =>
    limit(() =>
      translateBatch({
        sources: batchSources,
        targetLocale,
        model,
        config,
      }),
    ),
  );

  try {
    // Execute all translation batches with concurrency control
    const results = await Promise.all(translationPromises);

    // Merge all batch results
    const mergedTranslations = results.reduce(
      (acc, result) => ({
        translations: [...acc.translations, ...result.translations],
      }),
      { translations: [] },
    );

    return mergedTranslations;
  } catch (error) {
    throw new Error(`Translation failed: ${error.message}`);
  }
};
