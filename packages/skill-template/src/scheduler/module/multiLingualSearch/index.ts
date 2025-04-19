import { SkillRunnableConfig, BaseSkill } from '../../../base';
import { GraphState } from '../../types';
import { deduplicateSourcesByTitle, TimeTracker, batchTranslateText } from '@refly/utils';
import { Source } from '@refly/openapi-schema';

import {
  buildRewriteQuerySystemPrompt,
  buildRewriteQueryUserPrompt,
  rewriteQueryOutputSchema,
} from './rewriteQuery';
import { mergeSearchResults, searchResultsToSources, sourcesToSearchResults } from '@refly/utils';
import { translateResults } from './translateResult';
import { performConcurrentWebSearch } from './webSearch';
import { getOptimizedSearchLocales, normalizeLocale } from './locale';
import { extractStructuredData } from '../../utils/extractor';

/**
 * 目标：
 * 1. 基于用户输入的 query，结合 searchLocaleList 和 resultDisplayLocale，进行多轮搜索，得到最终的 sources
 * 2. 返回 sources 给前端进行展示
 *
 * 输入：
 * 1. 选择 searchLocaleList: string[], 和结果展示的 resultDisplayLocale: string | auto
 * 2. 输入查询 Query
 *
 * 输出：
 * 1. 多步推理：
 * 1.1 rewrite to multi query：比如存在多个意图，则需要拆分为多个 query 或者将不完整的某个意图补充完整
 * 1.2 基于 searchLocaleList 将 rewrite 后的 query 翻译为多语言，然后合并成一组 list query
 * 1.3 基于 list query 进行多轮搜索，得到初始的 sources
 * 1.4 将初始的 sources(title、description/snippet) 翻译为 resultDisplayLocale 对应的语言，整体组成 list sources
 * 1.5 基于 list sources 进行 rerank 排序生成最终的 sources 并返回
 *
 */

interface CallMultiLingualWebSearchParams {
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
  webSearchConcurrencyLimit: number;
  batchSize: number;
  enableDeepReasonWebSearch: boolean;
  enableQueryRewrite: boolean;
}

export const callMultiLingualWebSearch = async (
  params: CallMultiLingualWebSearchParams,
  ctx: {
    config: SkillRunnableConfig;
    ctxThis: BaseSkill;
    state: GraphState & { rewrittenQueries?: string[] };
  },
): Promise<{ sources: Source[] }> => {
  const { config, ctxThis, state } = ctx;
  const { engine } = ctxThis;

  const { query } = state;

  // TODO: 针对在 scheduler 里面调用,
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
  const webSearchConcurrencyLimit = params.webSearchConcurrencyLimit || 3;
  const batchSize = params.batchSize || 5;
  const enableDeepReasonWebSearch = params.enableDeepReasonWebSearch || false;
  const timeTracker = new TimeTracker();
  let finalResults: Source[] = [];

  const model = engine.chatModel({ temperature: 0.1 }, true);

  const enableQueryRewrite = params.enableQueryRewrite ?? true;

  try {
    let queries = rewrittenQueries || [query]; // Use rewrittenQueries if available

    // Step 1: Rewrite query (only if no rewrittenQueries provided)
    if (
      enableQueryRewrite &&
      (!rewrittenQueries || rewrittenQueries.length === 1 || rewrittenQueries.length === 0)
    ) {
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
    const searchLocaleListLen = enableDeepReasonWebSearch ? 3 : 2;
    const optimizedSearchLocales = getOptimizedSearchLocales(displayLocale, searchLocaleListLen);
    searchLocaleList = optimizedSearchLocales;

    engine.logger.log(`Recommended display locale: ${displayLocale}`);

    // Step 2: Translate query (if enabled)
    const queryMap: Record<string, string[]> = {};

    if (enableTranslateQuery) {
      timeTracker.startStep('translateQuery');
      try {
        // 构建翻译结果对象
        const _translations: Record<string, string[]> = {};

        // 为每个目标语言进行翻译
        for (const targetLocale of searchLocaleList) {
          try {
            // 使用标准化的 locale 进行比较
            if (normalizeLocale(targetLocale) === normalizeLocale(resultDisplayLocale)) {
              queryMap[targetLocale] = queries;
              continue;
            }

            // 批量翻译查询，使用标准化的 locale 进行翻译
            const translatedQueries = await batchTranslateText(
              queries,
              normalizeLocale(targetLocale),
              normalizeLocale(resultDisplayLocale),
            );
            queryMap[targetLocale] = translatedQueries;
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

    // Step 3: Perform concurrent web search
    timeTracker.startStep('webSearch');
    let allResults = [];
    try {
      allResults = await performConcurrentWebSearch({
        queryMap,
        searchLimit,
        concurrencyLimit: webSearchConcurrencyLimit,
        user: config.configurable.user,
        engine: engine,
        enableTranslateQuery,
      });
      const webSearchDuration = timeTracker.endStep('webSearch');
      engine.logger.log(`Web search completed in ${webSearchDuration}ms`);

      ctxThis.emitEvent(
        {
          log: {
            key: 'webSearchCompleted',
            descriptionArgs: {
              duration: webSearchDuration,
              totalResults: allResults?.length,
            },
          },
        },
        config,
      );
    } catch (error) {
      engine.logger.error(`Error in web search: ${error.stack}`);
      timeTracker.endStep('webSearch');
      // Continue with empty results if web search fails
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
    engine.logger.error(`Error in multilingual search: ${error.stack}`);
    // Return empty results in case of catastrophic failure
    return {
      sources: [],
    };
  }
};
