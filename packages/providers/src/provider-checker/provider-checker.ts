import { ProviderCategory } from '../../../openapi-schema/src';

export interface ProviderCheckConfig {
  providerId: string;
  providerKey: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  categories: string[];
}

export interface CheckResult {
  status: 'success' | 'failed' | 'unknown';
  data?: any;
  error?: string | { type?: string; message?: string; response?: any };
}

export interface ProviderCheckResult {
  providerId: string;
  providerKey: string;
  name: string;
  baseUrl?: string;
  categories: string[];
  status: 'success' | 'failed' | 'unknown';
  message: string;
  details: Record<string, CheckResult>;
  timestamp: string;
}

/**
 * Provider connection checker service - handles all provider connection checks
 * Moved from API layer to improve separation of concerns
 */
export class ProviderChecker {
  /**
   * Check provider connection and API availability
   */
  async checkProvider(
    config: ProviderCheckConfig,
    category?: ProviderCategory,
  ): Promise<ProviderCheckResult> {
    const checkResult: ProviderCheckResult = {
      providerId: config.providerId,
      providerKey: config.providerKey,
      name: config.name,
      baseUrl: config.baseUrl,
      categories: config.categories,
      status: 'unknown',
      message: '',
      details: {},
      timestamp: new Date().toISOString(),
    };

    try {
      // Route to specific provider check based on provider key
      switch (config.providerKey) {
        case 'openai':
        case 'anthropic':
          checkResult.details = await this.checkLLMProvider(config, category);
          break;
        case 'ollama':
          checkResult.details = await this.checkOllamaProvider(config, category);
          break;
        case 'jina':
          checkResult.details = await this.checkJinaProvider(config, category);
          break;
        case 'searxng':
          checkResult.details = await this.checkSearXngProvider(config);
          break;
        case 'serper':
          checkResult.details = await this.checkSerperProvider(config);
          break;
        default:
          // Generic OpenAI-compatible API check
          checkResult.details = await this.checkOpenAICompatibleProvider(config, category);
      }

      // Evaluate overall status based on individual check results
      const { status, message } = this.evaluateOverallStatus(
        checkResult.details,
        config.providerKey,
      );
      checkResult.status = status;
      checkResult.message = message;
    } catch (error: any) {
      checkResult.status = 'failed';
      checkResult.message = error?.message || 'Connection check failed';
      checkResult.details.error = {
        status: 'failed',
        error: {
          type: error?.constructor?.name || 'Error',
          message: error?.message,
          ...(error?.response ? { response: error.response } : {}),
        },
      };
    }

    return checkResult;
  }

  /**
   * Evaluate overall connection status based on individual check results
   */
  private evaluateOverallStatus(
    details: Record<string, CheckResult>,
    providerKey: string,
  ): { status: 'success' | 'failed' | 'unknown'; message: string } {
    // Define critical checks for each provider type
    const criticalChecks: Record<string, string[]> = {
      ollama: ['connectionTest'],
      openai: ['modelsEndpoint'],
      anthropic: ['modelsEndpoint'],
      jina: ['apiKey'],
      searxng: ['healthCheck'],
      serper: ['apiKeyValidation'],
      default: ['modelsEndpoint'], // For generic OpenAI-compatible providers
    };

    const checksToEvaluate = criticalChecks[providerKey] || criticalChecks.default;

    // Check if any critical checks failed
    const failedChecks: string[] = [];
    const successfulChecks: string[] = [];

    for (const checkName of checksToEvaluate) {
      const checkResult = details[checkName];
      if (checkResult) {
        if (checkResult.status === 'failed') {
          failedChecks.push(checkName);
        } else if (checkResult.status === 'success') {
          successfulChecks.push(checkName);
        }
      }
    }

    // Special case for Ollama: provide specific error messages
    if (providerKey === 'ollama') {
      const connectionResult = details.connectionTest;

      if (connectionResult?.status === 'success') {
        return {
          status: 'success',
          message: 'Connection check successful',
        };
      } else if (connectionResult?.status === 'failed') {
        const endpoint = connectionResult.data?.endpoint || 'unknown endpoint';
        return {
          status: 'failed',
          message: `Cannot connect to Ollama service at ${endpoint} - ${connectionResult.error}`,
        };
      } else {
        return {
          status: 'failed',
          message: 'Cannot connect to Ollama service - connection test failed',
        };
      }
    }

    // For other providers, if any critical check failed, overall status is failed
    if (failedChecks.length > 0) {
      return {
        status: 'failed',
        message: `Connection check failed - critical checks failed: ${failedChecks.join(', ')}`,
      };
    }

    // If all critical checks succeeded
    if (successfulChecks.length === checksToEvaluate.length) {
      return {
        status: 'success',
        message: 'Connection check successful',
      };
    }

    // If we have mixed results or unknown status
    const hasAnySuccess = Object.values(details).some((check) => check.status === 'success');
    if (hasAnySuccess) {
      return {
        status: 'success',
        message: 'Connection check partially successful',
      };
    }

    return {
      status: 'unknown',
      message: 'Connection check status unclear',
    };
  }

  /**
   * Check OpenAI/Anthropic compatible LLM provider
   */
  private async checkLLMProvider(
    config: ProviderCheckConfig,
    category?: ProviderCategory,
  ): Promise<Record<string, CheckResult>> {
    const checkResults: Record<string, CheckResult> = {
      modelsEndpoint: { status: 'unknown', data: null, error: null },
      chatCompletion: { status: 'unknown', data: null, error: null },
    };

    // Provider-specific authentication headers
    const getAuthHeaders = (apiKey: string) => {
      if (config.providerKey === 'anthropic') {
        return { 'x-api-key': apiKey };
      }
      // Default to OpenAI-style Bearer token for other providers
      return { Authorization: `Bearer ${apiKey}` };
    };

    // Check 1: Check /models endpoint
    try {
      const modelsResponse = await fetch(`${config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? getAuthHeaders(config.apiKey) : {}),
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        checkResults.modelsEndpoint.status = 'success';
        checkResults.modelsEndpoint.data = {
          statusCode: modelsResponse.status,
          modelCount: modelsData?.data?.length || 0,
          models: modelsData?.data?.slice(0, 5)?.map((m: any) => m.id || m.name) || [],
        };
      } else {
        checkResults.modelsEndpoint.status = 'failed';
        checkResults.modelsEndpoint.error = `HTTP ${modelsResponse.status}: ${modelsResponse.statusText}`;
      }
    } catch (error: any) {
      checkResults.modelsEndpoint.status = 'failed';
      checkResults.modelsEndpoint.error = error.message;
    }

    // Check 2: Check chat completion with minimal request (only if LLM category)
    if (!category || category === 'llm') {
      try {
        // Use provider-specific test models or first available model
        const getTestModel = () => {
          switch (config.providerKey) {
            case 'anthropic':
              return 'claude-3-haiku-20240307'; // A reliable Anthropic model
            case 'openai':
              return 'gpt-3.5-turbo'; // A reliable OpenAI model
            default: {
              // For generic providers, try to use the first available model from the models endpoint
              const availableModels = checkResults.modelsEndpoint?.data?.models;
              if (availableModels && availableModels.length > 0) {
                return availableModels[0];
              }
              // Fallback to a common model name
              return 'gpt-3.5-turbo';
            }
          }
        };

        const testModel = getTestModel();

        const requestBody = {
          model: testModel,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        };

        const chatResponse = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? getAuthHeaders(config.apiKey) : {}),
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        // Try to log the response body for debugging
        const responseText = await chatResponse.text();

        // Even 400/422 responses indicate the API is working and authenticated
        // We mainly want to avoid 401/403 (authentication errors)
        if (
          chatResponse.status < 500 &&
          chatResponse.status !== 401 &&
          chatResponse.status !== 403
        ) {
          checkResults.chatCompletion.status = 'success';
          checkResults.chatCompletion.data = {
            statusCode: chatResponse.status,
            contentType: chatResponse.headers.get('content-type'),
            responseBody:
              responseText.length > 200 ? `${responseText.substring(0, 200)}...` : responseText,
          };
        } else {
          checkResults.chatCompletion.status = 'failed';
          checkResults.chatCompletion.error = `HTTP ${chatResponse.status}: ${chatResponse.statusText}`;
        }
      } catch (error: any) {
        checkResults.chatCompletion.status = 'failed';
        checkResults.chatCompletion.error = error.message;
      }
    }

    return checkResults;
  }

  /**
   * Check Ollama provider
   */
  private async checkOllamaProvider(
    config: ProviderCheckConfig,
    _category?: ProviderCategory,
  ): Promise<Record<string, CheckResult>> {
    const checkResults: Record<string, CheckResult> = {
      connectionTest: { status: 'unknown', data: null, error: null },
    };

    try {
      // Simple GET request to test basic connectivity
      // For OpenAI-compatible URLs (ending with /v1), check health
      // For native Ollama URLs, check tags endpoint
      const testUrl = config.baseUrl?.endsWith('/v1')
        ? `${config.baseUrl}/models` // OpenAI-compatible endpoint
        : `${config.baseUrl}/api/tags`; // Native Ollama endpoint

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        checkResults.connectionTest.status = 'success';
        checkResults.connectionTest.data = {
          statusCode: response.status,
          endpoint: testUrl,
          contentType: response.headers.get('content-type'),
        };
      } else {
        checkResults.connectionTest.status = 'failed';
        checkResults.connectionTest.error = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error: any) {
      checkResults.connectionTest.status = 'failed';
      checkResults.connectionTest.error = error.message;
    }

    return checkResults;
  }

  /**
   * Check Jina provider
   */
  private async checkJinaProvider(
    config: ProviderCheckConfig,
    category?: ProviderCategory,
  ): Promise<Record<string, CheckResult>> {
    const checkResults: Record<string, CheckResult> = {
      apiKey: { status: 'unknown', data: null, error: null },
      embeddings: { status: 'unknown', data: null, error: null },
      reranker: { status: 'unknown', data: null, error: null },
    };

    if (!config.apiKey) {
      checkResults.apiKey.status = 'failed';
      checkResults.apiKey.error = 'API key is required for Jina provider';
      return checkResults;
    }

    checkResults.apiKey.status = 'success';

    // Check embeddings endpoint if category is embedding or not specified
    if (!category || category === 'embedding') {
      try {
        const embeddingResponse = await fetch('https://api.jina.ai/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: 'jina-embeddings-v2-base-en',
            input: ['test'],
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (embeddingResponse.ok) {
          checkResults.embeddings.status = 'success';
          checkResults.embeddings.data = { statusCode: embeddingResponse.status };
        } else {
          checkResults.embeddings.status = 'failed';
          checkResults.embeddings.error = `HTTP ${embeddingResponse.status}: ${embeddingResponse.statusText}`;
        }
      } catch (error: any) {
        checkResults.embeddings.status = 'failed';
        checkResults.embeddings.error = error.message;
      }
    }

    // Check reranker endpoint if category is reranker or not specified
    if (!category || category === 'reranker') {
      try {
        const rerankerResponse = await fetch('https://api.jina.ai/v1/rerank', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: 'jina-reranker-v1-base-en',
            query: 'test',
            documents: ['test document'],
            top_n: 1,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (rerankerResponse.ok) {
          checkResults.reranker.status = 'success';
          checkResults.reranker.data = { statusCode: rerankerResponse.status };
        } else {
          checkResults.reranker.status = 'failed';
          checkResults.reranker.error = `HTTP ${rerankerResponse.status}: ${rerankerResponse.statusText}`;
        }
      } catch (error: any) {
        checkResults.reranker.status = 'failed';
        checkResults.reranker.error = error.message;
      }
    }

    return checkResults;
  }

  /**
   * Check SearXNG provider
   */
  private async checkSearXngProvider(
    config: ProviderCheckConfig,
  ): Promise<Record<string, CheckResult>> {
    const checkResults: Record<string, CheckResult> = {
      healthCheck: { status: 'unknown', data: null, error: null },
      searchCheck: { status: 'unknown', data: null, error: null },
    };

    try {
      // Check basic connectivity
      const healthResponse = await fetch(`${config.baseUrl}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (healthResponse.ok) {
        checkResults.healthCheck.status = 'success';
        checkResults.healthCheck.data = { statusCode: healthResponse.status };

        // Check search functionality
        const searchResponse = await fetch(`${config.baseUrl}/search`, {
          method: 'GET',
          signal: AbortSignal.timeout(15000),
        });

        if (searchResponse.status < 500) {
          checkResults.searchCheck.status = 'success';
          checkResults.searchCheck.data = { statusCode: searchResponse.status };
        } else {
          checkResults.searchCheck.status = 'failed';
          checkResults.searchCheck.error = `HTTP ${searchResponse.status}: ${searchResponse.statusText}`;
        }
      } else {
        checkResults.healthCheck.status = 'failed';
        checkResults.healthCheck.error = `HTTP ${healthResponse.status}: ${healthResponse.statusText}`;
      }
    } catch (error: any) {
      checkResults.healthCheck.status = 'failed';
      checkResults.healthCheck.error = error.message;
    }

    return checkResults;
  }

  /**
   * Check Serper provider
   */
  private async checkSerperProvider(
    config: ProviderCheckConfig,
  ): Promise<Record<string, CheckResult>> {
    const checkResults: Record<string, CheckResult> = {
      apiKeyValidation: { status: 'unknown', data: null, error: null },
      searchFunction: { status: 'unknown', data: null, error: null },
    };

    if (!config.apiKey) {
      checkResults.apiKeyValidation.status = 'failed';
      checkResults.apiKeyValidation.error = 'API key is required for Serper';
      return checkResults;
    }

    try {
      // Test search function with a simple query
      const searchPayload = {
        q: 'test query',
        num: 1, // Limit to 1 result to minimize API usage
      };

      const searchResponse = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      const responseText = await searchResponse.text();

      if (searchResponse.ok) {
        const responseData = JSON.parse(responseText);
        checkResults.apiKeyValidation.status = 'success';
        checkResults.searchFunction.status = 'success';
        checkResults.searchFunction.data = {
          statusCode: searchResponse.status,
          resultsCount: responseData.organic?.length || 0,
          hasSearchParameters: !!responseData.searchParameters,
        };
      } else {
        // Check for specific error codes
        if (searchResponse.status === 401 || searchResponse.status === 403) {
          checkResults.apiKeyValidation.status = 'failed';
          checkResults.apiKeyValidation.error = 'Invalid API key or unauthorized access';
        } else if (searchResponse.status === 429) {
          checkResults.apiKeyValidation.status = 'success'; // API key is valid but rate limited
          checkResults.searchFunction.status = 'failed';
          checkResults.searchFunction.error = 'Rate limit exceeded';
        } else {
          checkResults.searchFunction.status = 'failed';
          checkResults.searchFunction.error = `HTTP ${searchResponse.status}: ${responseText}`;
        }
      }
    } catch (error: any) {
      console.error('[ProviderChecker] Serper test error:', error);

      if (error.name === 'AbortError') {
        checkResults.searchFunction.status = 'failed';
        checkResults.searchFunction.error = 'Request timeout - Serper API may be unavailable';
      } else {
        checkResults.searchFunction.status = 'failed';
        checkResults.searchFunction.error = error.message;
      }
    }

    return checkResults;
  }

  /**
   * Check generic OpenAI-compatible provider
   */
  private async checkOpenAICompatibleProvider(
    config: ProviderCheckConfig,
    category?: ProviderCategory,
  ): Promise<Record<string, CheckResult>> {
    // Use the same check as LLM providers since most custom providers are OpenAI-compatible
    return this.checkLLMProvider(config, category);
  }
}
