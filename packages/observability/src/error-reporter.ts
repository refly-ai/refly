import * as Sentry from '@sentry/node';

/**
 * Enumeration of LLM error categories for better classification and monitoring
 */
export enum LLMErrorCategory {
  // Token/Context errors
  TOKEN_LIMIT_EXCEEDED = 'token_limit_exceeded',
  CONTEXT_LENGTH_EXCEEDED = 'context_length_exceeded',

  // Input validation errors
  INVALID_MESSAGE_CONTENT = 'invalid_message_content',
  EMPTY_MESSAGE_CONTENT = 'empty_message_content',
  SPECIAL_TOKEN_ERROR = 'special_token_error',
  INVALID_IMAGE_FORMAT = 'invalid_image_format',

  // Tool errors
  TOOL_ALREADY_DEFINED = 'tool_already_defined',
  TOOL_VALIDATION_ERROR = 'tool_validation_error',

  // Network errors
  NETWORK_ERROR = 'network_error',
  SOCKET_HANG_UP = 'socket_hang_up',
  TIMEOUT = 'timeout',

  // Provider errors
  RATE_LIMIT = 'rate_limit',
  QUOTA_EXCEEDED = 'quota_exceeded',
  PROVIDER_ERROR = 'provider_error',

  // Other
  UNKNOWN = 'unknown',
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  category: LLMErrorCategory;
  isRetryable: boolean;
  severity: 'error' | 'warning' | 'info';
  userMessage: string;
}

/**
 * Patterns for classifying LLM errors
 */
const ERROR_PATTERNS: Array<{
  patterns: RegExp[];
  category: LLMErrorCategory;
  isRetryable: boolean;
  severity: 'error' | 'warning' | 'info';
  userMessage: string;
}> = [
  // Token/Context errors
  {
    patterns: [
      /input is too long/i,
      /maximum context length/i,
      /context_length_exceeded/i,
      /max_tokens_exceeded/i,
      /token limit/i,
      /exceeds the model's maximum context/i,
    ],
    category: LLMErrorCategory.TOKEN_LIMIT_EXCEEDED,
    isRetryable: false,
    severity: 'warning',
    userMessage: 'The input is too long. Please try with a shorter message or fewer documents.',
  },

  // Special token errors
  {
    patterns: [/disallowed special token/i, /<\|im_end\|>/i, /<\|im_start\|>/i],
    category: LLMErrorCategory.SPECIAL_TOKEN_ERROR,
    isRetryable: false,
    severity: 'warning',
    userMessage: 'Invalid characters detected in input. Please try again.',
  },

  // Empty/Invalid message content
  {
    patterns: [
      /invalid message content/i,
      /empty string/i,
      /'human' must contain non-empty content/i,
    ],
    category: LLMErrorCategory.EMPTY_MESSAGE_CONTENT,
    isRetryable: false,
    severity: 'warning',
    userMessage: 'Message content cannot be empty.',
  },

  // Image format errors
  {
    patterns: [/image\.format.*must not be null/i, /invalid image format/i, /image_url.*format/i],
    category: LLMErrorCategory.INVALID_IMAGE_FORMAT,
    isRetryable: false,
    severity: 'warning',
    userMessage: 'Invalid image format. Please use a supported image type.',
  },

  // Tool errors
  {
    patterns: [/tool.*is already defined/i, /duplicate tool/i],
    category: LLMErrorCategory.TOOL_ALREADY_DEFINED,
    isRetryable: false,
    severity: 'warning',
    userMessage: 'A tool configuration error occurred. Please try again.',
  },

  // Network errors
  {
    patterns: [/socket hang up/i, /econnreset/i, /econnrefused/i],
    category: LLMErrorCategory.SOCKET_HANG_UP,
    isRetryable: true,
    severity: 'warning',
    userMessage: 'Connection was interrupted. Please try again.',
  },
  {
    patterns: [/network.*error/i, /network connection/i, /fetch failed/i],
    category: LLMErrorCategory.NETWORK_ERROR,
    isRetryable: true,
    severity: 'warning',
    userMessage: 'Network error occurred. Please check your connection and try again.',
  },
  {
    patterns: [/timeout/i, /timed out/i, /etimedout/i],
    category: LLMErrorCategory.TIMEOUT,
    isRetryable: true,
    severity: 'warning',
    userMessage: 'Request timed out. Please try again.',
  },

  // Rate limit / Quota
  {
    patterns: [/rate.?limit/i, /too many requests/i, /429/i],
    category: LLMErrorCategory.RATE_LIMIT,
    isRetryable: true,
    severity: 'warning',
    userMessage: 'Rate limit reached. Please wait a moment and try again.',
  },
  {
    patterns: [/quota.*exceeded/i, /insufficient.*credit/i, /credit not available/i],
    category: LLMErrorCategory.QUOTA_EXCEEDED,
    isRetryable: false,
    severity: 'error',
    userMessage: 'Usage quota exceeded. Please check your account.',
  },

  // Provider errors (generic 400/500)
  {
    patterns: [/status code 400/i, /bad request/i],
    category: LLMErrorCategory.PROVIDER_ERROR,
    isRetryable: false,
    severity: 'error',
    userMessage: 'An error occurred while processing your request. Please try again.',
  },
];

/**
 * Classify an error into a known category
 */
export function classifyError(error: Error | string): ErrorClassification {
  const errorMessage = typeof error === 'string' ? error : error.message || String(error);

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.patterns.some((p) => p.test(errorMessage))) {
      return {
        category: pattern.category,
        isRetryable: pattern.isRetryable,
        severity: pattern.severity,
        userMessage: pattern.userMessage,
      };
    }
  }

  return {
    category: LLMErrorCategory.UNKNOWN,
    isRetryable: false,
    severity: 'error',
    userMessage: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Report an LLM error to Sentry with proper categorization and context
 */
export function reportLLMError(
  error: Error,
  context: {
    userId?: string;
    sessionId?: string;
    traceId?: string;
    modelId?: string;
    provider?: string;
    tokenCount?: number;
    contextLimit?: number;
    operation?: string;
    extra?: Record<string, unknown>;
  },
): ErrorClassification {
  const classification = classifyError(error);

  // Log locally for debugging
  console.error('[LLM Error]', {
    category: classification.category,
    isRetryable: classification.isRetryable,
    severity: classification.severity,
    message: error.message,
    modelId: context.modelId,
    provider: context.provider,
  });

  // Report to Sentry
  Sentry.captureException(error, {
    user: context.userId ? { id: context.userId } : undefined,
    tags: {
      'llm.error_category': classification.category,
      'llm.is_retryable': String(classification.isRetryable),
      'llm.severity': classification.severity,
      'llm.model_id': context.modelId,
      'llm.provider': context.provider,
    },
    contexts: {
      llm: {
        model_id: context.modelId,
        provider: context.provider,
        token_count: context.tokenCount,
        context_limit: context.contextLimit,
        operation: context.operation,
        trace_id: context.traceId,
        session_id: context.sessionId,
      },
    },
    extra: context.extra,
    fingerprint: ['llm-error', classification.category, context.provider || 'unknown'],
  });

  return classification;
}

/**
 * Report a token usage warning when approaching limits
 */
export function reportTokenUsageWarning(context: {
  userId?: string;
  traceId?: string;
  modelId?: string;
  provider?: string;
  tokenCount: number;
  contextLimit: number;
  usagePercent: number;
}): void {
  const { usagePercent, tokenCount, contextLimit } = context;

  // Only report if usage is above threshold
  if (usagePercent < 80) {
    return;
  }

  const level = usagePercent >= 95 ? 'error' : usagePercent >= 90 ? 'warning' : 'info';

  // Log locally for debugging
  console.warn('[LLM Token Warning]', {
    level,
    usagePercent: `${usagePercent.toFixed(1)}%`,
    tokenCount,
    contextLimit,
    modelId: context.modelId,
  });

  // Report to Sentry
  Sentry.captureMessage(`LLM token usage at ${usagePercent.toFixed(1)}%`, {
    level,
    tags: {
      'llm.token_usage_level': level,
      'llm.model_id': context.modelId,
      'llm.provider': context.provider,
    },
    contexts: {
      token_usage: {
        token_count: tokenCount,
        context_limit: contextLimit,
        usage_percent: usagePercent,
        trace_id: context.traceId,
      },
    },
    user: context.userId ? { id: context.userId } : undefined,
    fingerprint: ['llm-token-usage-warning', context.modelId || 'unknown'],
  });
}

/**
 * Create a Sentry breadcrumb for LLM operations
 */
export function addLLMBreadcrumb(data: {
  operation: string;
  modelId?: string;
  tokenCount?: number;
  status: 'started' | 'completed' | 'failed';
  message?: string;
}): void {
  Sentry.addBreadcrumb({
    category: 'llm',
    message: `LLM ${data.operation} ${data.status}`,
    level: data.status === 'failed' ? 'error' : 'info',
    data: {
      model_id: data.modelId,
      token_count: data.tokenCount,
      status: data.status,
      message: data.message,
    },
  });
}
