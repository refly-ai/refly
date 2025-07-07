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
   * Generate standardized error message based on HTTP status code
   */
  private generateHttpErrorMessage(status: number, statusText: string, context?: string): string {
    let errorMessage = `HTTP ${status}: ${statusText}`;

    if (status === 401) {
      errorMessage += ' - Invalid API key or unauthorized access';
    } else if (status === 403) {
      errorMessage += ' - Access forbidden, check API key permissions';
    } else if (status === 404) {
      errorMessage += context ? ` - ${context} not found` : ' - Resource not found';
    } else if (status === 429) {
      errorMessage += ' - Rate limit exceeded';
    } else if (status >= 400 && status < 500) {
      errorMessage += context
        ? ` - Client error, check ${context}`
        : ' - Client error, check request format and API key';
    }

    return errorMessage;
  }

  /**
   * Create initial check result structure
   */
  private createCheckResult(): CheckResult {
    return { status: 'unknown', data: null, error: null };
  }

  /**
   * Perform a standardized API request with common error handling
   */
  private async performApiRequest(
    url: string,
    options: RequestInit,
    timeout = 10000,
  ): Promise<{ response: Response; isSuccess: boolean; errorMessage?: string }> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeout),
      });

      const isSuccess = response.status >= 200 && response.status < 300;
      const errorMessage = isSuccess
        ? undefined
        : this.generateHttpErrorMessage(response.status, response.statusText);

      return { response, isSuccess, errorMessage };
    } catch (error: any) {
      return {
        response: null as any,
        isSuccess: false,
        errorMessage: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Handle API key validation for providers that require it
   */
  private validateApiKey(config: ProviderCheckConfig, providerName: string): CheckResult | null {
    if (!config.apiKey) {
      return {
        status: 'failed',
        data: null,
        error: `API key is required for ${providerName} provider`,
      };
    }
    return null;
  }

  /**
   * Get authentication headers based on provider type
   */
  private getAuthHeaders(config: ProviderCheckConfig): Record<string, string> {
    if (!config.apiKey) return {};

    if (config.providerKey === 'anthropic') {
      return { 'x-api-key': config.apiKey };
    }
    // Default to OpenAI-style Bearer token for other providers
    return { Authorization: `Bearer ${config.apiKey}` };
  }

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
      apiAvailability: this.createCheckResult(),
    };

    // Debug logging for API key
    console.log(
      `[ProviderChecker] ${config.providerId} - hasApiKey: ${!!config.apiKey}, baseUrl: ${config.baseUrl}`,
    );

    // Single API availability check using models endpoint
    const { response, isSuccess, errorMessage } = await this.performApiRequest(
      `${config.baseUrl}/models`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(config),
        },
      },
      10000,
    );

    if (isSuccess) {
      const responseData = await response.json();
      checkResults.apiAvailability.status = 'success';
      checkResults.apiAvailability.data = {
        statusCode: response.status,
        modelCount: responseData?.data?.length || 0,
        responseTime: Date.now(),
      };
    } else {
      checkResults.apiAvailability.status = 'failed';
      checkResults.apiAvailability.error = errorMessage;
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
      connectionTest: this.createCheckResult(),
    };

    // Simple GET request to test basic connectivity
    // For OpenAI-compatible URLs (ending with /v1), check health
    // For native Ollama URLs, check tags endpoint
    const testUrl = config.baseUrl?.endsWith('/v1')
      ? `${config.baseUrl}/models` // OpenAI-compatible endpoint
      : `${config.baseUrl}/api/tags`; // Native Ollama endpoint

    console.log(`[ProviderChecker] Testing Ollama connection: ${testUrl}`);

    const { response, isSuccess, errorMessage } = await this.performApiRequest(
      testUrl,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(config),
        },
      },
      10000,
    );

    if (isSuccess) {
      checkResults.connectionTest.status = 'success';
      checkResults.connectionTest.data = {
        statusCode: response.status,
        endpoint: testUrl,
        contentType: response.headers.get('content-type'),
      };
    } else {
      checkResults.connectionTest.status = 'failed';
      checkResults.connectionTest.error = errorMessage;
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
      apiAvailability: this.createCheckResult(),
    };

    // Validate API key
    const apiKeyError = this.validateApiKey(config, 'Jina');
    if (apiKeyError) {
      checkResults.apiAvailability = apiKeyError;
      return checkResults;
    }

    // Simple API availability check using minimal request
    const { response, isSuccess, errorMessage } = await this.performApiRequest(
      'https://api.jina.ai/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v2-base-en',
          input: ['test'], // Minimal input to check API key validity
        }),
      },
      10000,
    );

    if (isSuccess) {
      checkResults.apiAvailability.status = 'success';
      checkResults.apiAvailability.data = {
        statusCode: response.status,
        responseTime: Date.now(),
      };
    } else {
      checkResults.apiAvailability.status = 'failed';
      checkResults.apiAvailability.error = errorMessage;
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
      healthCheck: this.createCheckResult(),
      searchCheck: this.createCheckResult(),
    };

    // Check basic connectivity
    const {
      response: healthResponse,
      isSuccess: healthSuccess,
      errorMessage: healthError,
    } = await this.performApiRequest(`${config.baseUrl}`, { method: 'GET' }, 10000);

    if (healthSuccess) {
      checkResults.healthCheck.status = 'success';
      checkResults.healthCheck.data = { statusCode: healthResponse.status };

      // Check search functionality
      const {
        response: searchResponse,
        isSuccess: searchSuccess,
        errorMessage: searchError,
      } = await this.performApiRequest(`${config.baseUrl}/search`, { method: 'GET' }, 15000);

      if (searchSuccess) {
        checkResults.searchCheck.status = 'success';
        checkResults.searchCheck.data = { statusCode: searchResponse.status };
      } else {
        checkResults.searchCheck.status = 'failed';
        checkResults.searchCheck.error = searchError;
      }
    } else {
      checkResults.healthCheck.status = 'failed';
      checkResults.healthCheck.error = healthError;
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
      apiKeyValidation: this.createCheckResult(),
      searchFunction: this.createCheckResult(),
    };

    // Debug logging
    console.log(`[ProviderChecker] ${config.providerId} - hasApiKey: ${!!config.apiKey}`);

    // Validate API key
    const apiKeyError = this.validateApiKey(config, 'Serper');
    if (apiKeyError) {
      checkResults.apiKeyValidation = apiKeyError;
      return checkResults;
    }

    // Test search function with a simple query
    const searchPayload = {
      q: 'test query',
      num: 1, // Limit to 1 result to minimize API usage
    };

    console.log('[ProviderChecker] Serper search request:', JSON.stringify(searchPayload, null, 2));

    const { response, isSuccess, errorMessage } = await this.performApiRequest(
      'https://google.serper.dev/search',
      {
        method: 'POST',
        headers: {
          'X-API-KEY': config.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
      },
      15000,
    );

    if (isSuccess) {
      const responseText = await response.text();
      const responseData = JSON.parse(responseText);
      checkResults.apiKeyValidation.status = 'success';
      checkResults.searchFunction.status = 'success';
      checkResults.searchFunction.data = {
        statusCode: response.status,
        resultsCount: responseData.organic?.length || 0,
        hasSearchParameters: !!responseData.searchParameters,
      };
    } else {
      // Check for specific error codes
      if (response?.status === 401 || response?.status === 403) {
        checkResults.apiKeyValidation.status = 'failed';
        checkResults.apiKeyValidation.error = 'Invalid API key or unauthorized access';
      } else if (response?.status === 429) {
        checkResults.apiKeyValidation.status = 'success'; // API key is valid but rate limited
        checkResults.searchFunction.status = 'failed';
        checkResults.searchFunction.error = 'Rate limit exceeded';
      } else {
        checkResults.searchFunction.status = 'failed';
        checkResults.searchFunction.error = errorMessage;
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
