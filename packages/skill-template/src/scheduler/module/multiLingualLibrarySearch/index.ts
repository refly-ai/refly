import { SkillRunnableConfig, BaseSkill } from '../../../base';
import { GraphState } from '../../types';
import { deduplicateSourcesByTitle, TimeTracker, batchTranslateText } from '@refly-packages/utils';
import { Source } from '@refly-packages/openapi-schema';

import {
  buildRewriteQuerySystemPrompt,
  buildRewriteQueryUserPrompt,
  rewriteQueryOutputSchema,
} from '../multiLingualSearch/rewriteQuery';
import {
  mergeSearchResults,
  searchResultsToSources,
  sourcesToSearchResults,
} from '@refly-packages/utils';
import { translateResults } from '../multiLingualSearch/translateResult';
import { getOptimizedSearchLocales, normalizeLocale } from '../multiLingualSearch/locale';
import { extractStructuredData } from '../../utils/extractor';
import { performConcurrentLibrarySearch } from './librarySearch';

/**
 * Goal:
 * 1. Based on user input query, combined with searchLocaleList and resultDisplayLocale, perform multi-round search to get final sources
 * 2. Return sources for display
 *
 * Input:
 * 1. Select searchLocaleList: string[], and result display locale resultDisplayLocale: string | auto
 * 2. Input query
 *
 * Output:
 * 1. Multi-step reasoning:
 * 1.1 Rewrite to multi query: If there are multiple intents, split into multiple queries or complete incomplete intents
 * 1.2 Translate rewritten queries to multiple languages based on searchLocaleList, then merge into a list of queries
 * 1.3 Perform multi-round search based on the list of queries to get initial sources
 * 1.4 Translate initial sources (title, description/snippet) to the language corresponding to resultDisplayLocale
 * 1.5 Rerank the list of sources to generate final sources and return
 */

interface CallMultiLingualLibrarySearchParams {
  rewrittenQueries?: string[];
  searchLimit: number;
  searchLocaleList: string[];
  resultDisplayLocale: string;
  enableRerank: boolean;
  enableTranslateQuery: boolean;
  enableTranslateResult: boolean;
  rerankRelevanceThreshold?: number;
  rerankLimit?: number;
  translateConcurrencyLimit: number;
  libraryConcurrencyLimit: number;
  batchSize: number;
  enableDeepSearch: boolean;
  enableQueryRewrite: boolean;
  enableSearchWholeSpace?: boolean;
}

export const callMultiLingualLibrarySearch = async (
  params: CallMultiLingualLibrarySearchParams,
  ctx: {
    config: SkillRunnableConfig;
    ctxThis: BaseSkill;
    state: GraphState & { rewrittenQueries?: string[] };
  },
): Promise<{ sources: Source[] }> => {
  const { config, ctxThis, state } = ctx;
  const { engine } = ctxThis;

  const { query } = state;

  const { rewrittenQueries } = params;
  let searchLocaleList = params.searchLocaleList || ['en'];
  const resultDisplayLocale = params.resultDisplayLocale || 'auto';
  const enableRerank = params.enableRerank || false;
  const enableTranslateQuery = params.enableTranslateQuery || false;
  const enableTranslateResult = params.enableTranslateResult || false;
  const searchLimit = params.searchLimit || 10;
  const rerankRelevanceThreshold = params.rerankRelevanceThreshold || 0.1;
  const rerankLimit = params.rerankLimit;
  const translateConcurrencyLimit = params.translateConcurrencyLimit || 10;
  const libraryConcurrencyLimit = params.libraryConcurrencyLimit || 3;
  const batchSize = params.batchSize || 5;
  const enableDeepSearch = params.enableDeepSearch || false;
  const enableSearchWholeSpace = params.enableSearchWholeSpace || false;
  const timeTracker = new TimeTracker();
  let finalResults: Source[] = [];

  const model = engine.chatModel({ temperature: 0.1 }, true);

  const enableQueryRewrite = params.enableQueryRewrite ?? true;

  try {
    let queries = rewrittenQueries || [query]; // Use rewrittenQueries if available

    // Step 1: Rewrite query (only if no rewrittenQueries provided)
    if (enableQueryRewrite && (!rewrittenQueries || rewrittenQueries.length === 0)) {
      timeTracker.startStep('rewriteQuery');
      try {
        const rewriteResult = await extractStructuredData(
          model,
          rewriteQueryOutputSchema,
          `${buildRewriteQuerySystemPrompt()}\n\n${buildRewriteQueryUserPrompt({ query })}`,
          config,
          3,
          ctx?.config?.configurable?.modelInfo,
        );

        queries = rewriteResult?.queries?.rewrittenQueries || [query];
        const rewriteDuration = timeTracker.endStep('rewriteQuery');
        engine.logger.log(`Rewrite queries completed in ${rewriteDuration}ms`);
        ctxThis.emitEvent(
          {
            log: {
              key: 'rewriteQuery',
              descriptionArgs: {
                duration: rewriteDuration,
                rewrittenQueries: rewriteResult.queries.rewrittenQueries.join(', '),
              },
            },
          },
          config,
        );

        engine.logger.log(`Search analysis: ${JSON.stringify(rewriteResult.analysis)}`);
      } catch (error) {
        engine.logger.error(`Error in query rewrite: ${error.stack}`);
        // Fallback to original query
        queries = [query];
        timeTracker.endStep('rewriteQuery');
      }
    } else if (rewrittenQueries) {
      // If rewrittenQueries provided, emit event with them
      const rewriteDuration = 0; // No actual rewrite performed
      ctxThis.emitEvent(
        {
          log: {
            key: 'rewriteQuery',
            descriptionArgs: {
              duration: rewriteDuration,
              rewrittenQueries: rewrittenQueries.join(', '),
            },
          },
        },
        config,
      );
    }

    // Determine display locale
    const displayLocale = resultDisplayLocale;
    const searchLocaleListLen = enableDeepSearch ? 3 : 2;
    const optimizedSearchLocales = getOptimizedSearchLocales(displayLocale, searchLocaleListLen);
    searchLocaleList = optimizedSearchLocales;

    engine.logger.log(`Recommended display locale: ${displayLocale}`);

    // Step 2: Translate query (if enabled)
    const queryMap: Record<string, string[]> = {};

    if (enableTranslateQuery) {
      timeTracker.startStep('translateQuery');
      try {
        // For each target language
        for (const targetLocale of searchLocaleList) {
          try {
            // If target locale is the same as display locale, no need to translate
            if (normalizeLocale(targetLocale) === normalizeLocale(resultDisplayLocale)) {
              queryMap[targetLocale] = queries;
              continue;
            }

            // Use batchTranslateText from utils instead of service.translate
            const translatedQueries = await batchTranslateText(
              queries,
              normalizeLocale(targetLocale),
              normalizeLocale(resultDisplayLocale),
            );
            queryMap[targetLocale] = translatedQueries || queries;
          } catch (localeError) {
            engine.logger.error(
              `Error translating for locale ${targetLocale}: ${localeError.stack}`,
            );
            // Fallback to original queries for this locale
            queryMap[targetLocale] = queries;
          }
        }

        const translateQueryDuration = timeTracker.endStep('translateQuery');
        engine.logger.log(`Translate query completed in ${translateQueryDuration}ms`);

        ctxThis.emitEvent(
          {
            log: {
              key: 'translateQuery',
              descriptionArgs: {
                duration: translateQueryDuration,
                translatedQueries: Object.values(queryMap).join(', '),
              },
            },
          },
          config,
        );
      } catch (error) {
        engine.logger.error(`Error in query translation: ${error.stack}`);
        // Fallback to original queries for all locales
        for (const locale of searchLocaleList) {
          queryMap[locale] = queries;
        }
        timeTracker.endStep('translateQuery');
      }
    } else {
      // If translation is disabled, use original queries for all locales
      for (const locale of searchLocaleList) {
        queryMap[locale] = queries;
      }
    }

    // Step 3: Perform concurrent library search
    timeTracker.startStep('librarySearch');
    let allResults = [];
    try {
      allResults = await performConcurrentLibrarySearch({
        queryMap,
        searchLimit,
        concurrencyLimit: libraryConcurrencyLimit,
        user: config.configurable.user,
        engine: engine,
        enableTranslateQuery,
        enableSearchWholeSpace,
      });
      const librarySearchDuration = timeTracker.endStep('librarySearch');
      engine.logger.log(`Library search completed in ${librarySearchDuration}ms`);

      ctxThis.emitEvent(
        {
          log: {
            key: 'librarySearchCompleted',
            descriptionArgs: {
              duration: librarySearchDuration,
              totalResults: allResults?.length,
            },
          },
        },
        config,
      );
    } catch (error) {
      engine.logger.error(`Error in library search: ${error.stack}`);
      timeTracker.endStep('librarySearch');
      // Continue with empty results if library search fails
      allResults = [];
    }

    // Make merging results optional
    finalResults = mergeSearchResults(allResults);

    if (enableTranslateResult && finalResults.length > 0) {
      // Step 4: Translate merged results to display locale
      timeTracker.startStep('translateResults');
      try {
        const translatedResults = await translateResults({
          sources: finalResults,
          targetLocale: displayLocale,
          model,
          config,
          concurrencyLimit: translateConcurrencyLimit,
          batchSize,
        });
        const translateResultsDuration = timeTracker.endStep('translateResults');
        engine.logger.log(`Translate results completed in ${translateResultsDuration}ms`);
        ctxThis.emitEvent(
          {
            log: {
              key: 'translateResults',
              descriptionArgs: {
                duration: translateResultsDuration,
                totalResults: finalResults?.length,
              },
            },
          },
          config,
        );

        // Map translated results back to Source format
        const translatedSources = translatedResults.translations.map((translation, index) => ({
          ...finalResults[index],
          title: translation.title || finalResults[index].title,
          pageContent: translation.snippet || finalResults[index].pageContent,
          url: translation.originalUrl || finalResults[index].url,
          metadata: {
            originalLocale: finalResults[index]?.metadata?.originalLocale,
            translatedDisplayLocale: displayLocale,
          },
        }));

        finalResults = translatedSources;
      } catch (error) {
        engine.logger.error(`Error in translating results: ${error.stack}`);
        timeTracker.endStep('translateResults');
        // Keep original results if translation fails
      }
    }

    if (enableRerank && finalResults.length > 0) {
      // Step 5: Rerank results
      timeTracker.startStep('rerank');
      try {
        // Convert translated sources to search results format
        const searchResults = sourcesToSearchResults(finalResults);

        // Perform reranking
        const rerankResponse = await engine.service.rerank(query, searchResults, {
          topN: rerankLimit || searchResults.length,
          relevanceThreshold: rerankRelevanceThreshold,
        });

        // Convert back to Source format
        if (rerankResponse?.data) {
          finalResults = searchResultsToSources(rerankResponse.data);
        }

        const rerankDuration = timeTracker.endStep('rerank');
        engine.logger.log(`Rerank completed in ${rerankDuration}ms`);
        ctxThis.emitEvent(
          {
            log: {
              key: 'rerankResults',
              descriptionArgs: {
                duration: rerankDuration,
                totalResults: finalResults.length,
              },
            },
          },
          config,
        );
      } catch (error) {
        engine.logger.error(`Error in reranking: ${error.stack}`);
        timeTracker.endStep('rerank');
        // Keep original results order if reranking fails
      }
    }

    const stepSummary = timeTracker.getSummary();
    const totalDuration = stepSummary.totalDuration;
    engine.logger.log(`Total duration: ${totalDuration}`);
    engine.logger.log(`Results count: ${finalResults.length}`);

    // Deduplicate sources by title
    try {
      finalResults = deduplicateSourcesByTitle(finalResults);
    } catch (error) {
      engine.logger.error(`Error in deduplicating results: ${error.stack}`);
      // Keep original results if deduplication fails
    }

    // Return results with analysis
    return {
      sources: finalResults,
    };
  } catch (error) {
    engine.logger.error(`Error in multilingual library search: ${error.stack}`);
    // Return empty results in case of catastrophic failure
    return {
      sources: [],
    };
  }
};
