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
        category,
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
    _category?: ProviderCategory,
  ): { status: 'success' | 'failed' | 'unknown'; message: string } {
    // Define critical checks for each provider type
    const criticalChecks: Record<string, string[]> = {
      ollama: ['connectionTest'],
      openai: ['apiAvailability'],
      anthropic: ['apiAvailability'],
      jina: ['apiAvailability'], // Simple API availability check
      searxng: ['healthCheck'],
      serper: ['apiKeyValidation'],
      default: ['apiAvailability'], // For generic OpenAI-compatible providers
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

    // Special case for Jina: simple API availability check
    if (providerKey === 'jina') {
      const apiAvailabilityResult = details.apiAvailability;

      if (apiAvailabilityResult?.status === 'success') {
        return { status: 'success', message: 'Connection check successful' };
      } else if (apiAvailabilityResult?.status === 'failed') {
        return {
          status: 'failed',
          message: `Connection check failed - apiAvailability: ${apiAvailabilityResult.error || 'Unknown error'}`,
        };
      }

      return {
        status: 'failed',
        message: 'Connection check failed - API availability could not be verified',
      };
    }

    // For other providers, if any critical check failed, overall status is failed
    if (failedChecks.length > 0) {
      // Get the first failed check's detailed error message
      const firstFailedCheck = failedChecks[0];
      const failedCheckResult = details[firstFailedCheck];
      const detailedError = failedCheckResult?.error || 'Unknown error';

      return {
        status: 'failed',
        message: `Connection check failed - ${firstFailedCheck}: ${detailedError}`,
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
    _category?: ProviderCategory,
  ): Promise<Record<string, CheckResult>> {
    const checkResults: Record<string, CheckResult> = {
      apiAvailability: { status: 'unknown', data: null, error: null },
    };

    // Debug logging for API key
    console.log(
      `[ProviderChecker] ${config.providerId} - hasApiKey: ${!!config.apiKey}, baseUrl: ${config.baseUrl}`,
    );

    // Provider-specific authentication headers
    const getAuthHeaders = (apiKey: string) => {
      if (config.providerKey === 'anthropic') {
        return { 'x-api-key': apiKey };
      }
      // Default to OpenAI-style Bearer token for other providers
      return { Authorization: `Bearer ${apiKey}` };
    };

    // Single API availability check using models endpoint
    try {
      const apiResponse = await fetch(`${config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? getAuthHeaders(config.apiKey) : {}),
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // Only 2xx status codes indicate successful API connection
      if (apiResponse.status >= 200 && apiResponse.status < 300) {
        const responseData = await apiResponse.json();
        checkResults.apiAvailability.status = 'success';
        checkResults.apiAvailability.data = {
          statusCode: apiResponse.status,
          modelCount: responseData?.data?.length || 0,
          responseTime: Date.now(),
        };
      } else {
        checkResults.apiAvailability.status = 'failed';
        // Provide specific error messages for common status codes
        let errorMessage = `HTTP ${apiResponse.status}: ${apiResponse.statusText}`;
        if (apiResponse.status === 401) {
          errorMessage += ' - Invalid API key or unauthorized access';
        } else if (apiResponse.status === 403) {
          errorMessage += ' - Access forbidden, check API key permissions';
        } else if (apiResponse.status === 429) {
          errorMessage += ' - Rate limit exceeded';
        } else if (apiResponse.status >= 400 && apiResponse.status < 500) {
          errorMessage += ' - Client error, check request format and API key';
        }
        checkResults.apiAvailability.error = errorMessage;
      }
    } catch (error: any) {
      checkResults.apiAvailability.status = 'failed';
      checkResults.apiAvailability.error = `Connection failed: ${error.message}`;
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

      console.log(`[ProviderChecker] Testing Ollama connection: ${testUrl}`);

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
        // Provide more specific error messages for common status codes
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        if (response.status === 401) {
          errorMessage += ' - Invalid API key or unauthorized access';
        } else if (response.status === 403) {
          errorMessage += ' - Access forbidden, check API key permissions';
        } else if (response.status === 429) {
          errorMessage += ' - Rate limit exceeded';
        } else if (response.status >= 400 && response.status < 500) {
          errorMessage += ' - Client error, check connection settings';
        }
        checkResults.connectionTest.error = errorMessage;
      }
    } catch (error: any) {
      checkResults.connectionTest.status = 'failed';
      checkResults.connectionTest.error = error.message;
    }

    return checkResults;
  }

  /**
   * Check Jina provider - simple API availability check
   */
  private async checkJinaProvider(
    config: ProviderCheckConfig,
    _category?: ProviderCategory,
  ): Promise<Record<string, CheckResult>> {
    const checkResults: Record<string, CheckResult> = {
      apiAvailability: { status: 'unknown', data: null, error: null },
    };

    if (!config.apiKey) {
      checkResults.apiAvailability.status = 'failed';
      checkResults.apiAvailability.error = 'API key is required for Jina provider';
      return checkResults;
    }

    // Simple API availability check using minimal request
    try {
      // Use a lightweight endpoint or minimal request to verify API key validity
      // We'll use the embeddings endpoint with minimal payload just to check authentication
      const apiResponse = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v2-base-en',
          input: ['test'], // Minimal input to check API key validity
        }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // Only 2xx status codes indicate successful API connection
      if (apiResponse.status >= 200 && apiResponse.status < 300) {
        checkResults.apiAvailability.status = 'success';
        checkResults.apiAvailability.data = {
          statusCode: apiResponse.status,
          responseTime: Date.now(),
        };
      } else {
        checkResults.apiAvailability.status = 'failed';
        // Provide specific error messages for common status codes
        let errorMessage = `HTTP ${apiResponse.status}: ${apiResponse.statusText}`;
        if (apiResponse.status === 401) {
          errorMessage += ' - Invalid API key or unauthorized access';
        } else if (apiResponse.status === 403) {
          errorMessage += ' - Access forbidden, check API key permissions';
        } else if (apiResponse.status === 429) {
          errorMessage += ' - Rate limit exceeded';
        } else if (apiResponse.status >= 400 && apiResponse.status < 500) {
          errorMessage += ' - Client error, check request format and API key';
        }
        checkResults.apiAvailability.error = errorMessage;
      }
    } catch (error: any) {
      checkResults.apiAvailability.status = 'failed';
      checkResults.apiAvailability.error = `Connection failed: ${error.message}`;
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

        if (searchResponse.status >= 200 && searchResponse.status < 300) {
          checkResults.searchCheck.status = 'success';
          checkResults.searchCheck.data = { statusCode: searchResponse.status };
        } else {
          checkResults.searchCheck.status = 'failed';
          // Provide more specific error messages for common status codes
          let errorMessage = `HTTP ${searchResponse.status}: ${searchResponse.statusText}`;
          if (searchResponse.status === 401) {
            errorMessage += ' - Authentication required';
          } else if (searchResponse.status === 403) {
            errorMessage += ' - Access forbidden';
          } else if (searchResponse.status === 404) {
            errorMessage += ' - Search endpoint not found';
          } else if (searchResponse.status === 429) {
            errorMessage += ' - Rate limit exceeded';
          } else if (searchResponse.status >= 400 && searchResponse.status < 500) {
            errorMessage += ' - Client error, check SearXNG configuration';
          }
          checkResults.searchCheck.error = errorMessage;
        }
      } else {
        checkResults.healthCheck.status = 'failed';
        // Provide more specific error messages for common status codes
        let errorMessage = `HTTP ${healthResponse.status}: ${healthResponse.statusText}`;
        if (healthResponse.status === 401) {
          errorMessage += ' - Authentication required';
        } else if (healthResponse.status === 403) {
          errorMessage += ' - Access forbidden';
        } else if (healthResponse.status === 404) {
          errorMessage += ' - SearXNG service not found at this URL';
        } else if (healthResponse.status === 429) {
          errorMessage += ' - Rate limit exceeded';
        } else if (healthResponse.status >= 400 && healthResponse.status < 500) {
          errorMessage += ' - Client error, check SearXNG URL';
        }
        checkResults.healthCheck.error = errorMessage;
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

    // Debug logging
    console.log(`[ProviderChecker] ${config.providerId} - hasApiKey: ${!!config.apiKey}`);

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

      console.log(
        '[ProviderChecker] Serper search request:',
        JSON.stringify(searchPayload, null, 2),
      );

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
      console.log(`[ProviderChecker] Serper response status: ${searchResponse.status}`);

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
