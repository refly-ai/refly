import {
  // Model-related errors
  ModelProviderError,
  ModelProviderTimeout,
  ModelProviderRateLimitExceeded,
  ModelUsageQuotaExceeded,
  ModelNotSupportedError,
  ContentTooLargeError,
  PayloadTooLargeError,
  ChatModelNotConfiguredError,
  EmbeddingNotConfiguredError,
  MediaProviderNotConfiguredError,
  MediaModelNotConfiguredError,
  ContentFilteringError,
  // System errors
  UnknownError,
  ConnectionError,
  ParamsError,
  OAuthError,
  AccountNotFoundError,
  PasswordIncorrect,
  EmailAlreadyRegistered,
  InvalidVerificationSession,
  IncorrectVerificationCode,
  OperationTooFrequent,
  AuthenticationExpiredError,
  UnsupportedFileTypeError,
  EmbeddingNotAllowedToChangeError,
  // Resource not found errors
  CanvasNotFoundError,
  ResourceNotFoundError,
  DocumentNotFoundError,
  ReferenceNotFoundError,
  ReferenceObjectMissingError,
  SkillNotFoundError,
  LabelClassNotFoundError,
  LabelInstanceNotFoundError,
  ShareNotFoundError,
  PageNotFoundError,
  ActionResultNotFoundError,
  StaticFileNotFoundError,
  CodeArtifactNotFoundError,
  ProjectNotFoundError,
  ProviderNotFoundError,
  ProviderItemNotFoundError,
  McpServerNotFoundError,
  CanvasVersionNotFoundError,
  ProviderMisconfigurationError,
  ToolsetNotFoundError,
  WorkflowExecutionNotFoundError,
  // Quota and content errors
  StorageQuotaExceeded,
  // Execution errors
  ActionAborted,
  DuplicationNotAllowedError,
} from '@refly/errors';
/**
 * Types of execution failures that can be classified
 */
export type FailureType = 'modelCall' | 'toolCall' | 'multimodal' | 'workflow' | 'contentFiltering';

/**
 * Classify error types based on error instances and error codes
 *
 * @param error - The error instance or error string
 * @param errorCode - Optional error code for additional classification
 * @returns The failure type or null if it's not a classifiable execution error
 */
export function classifyExecutionError(
  error: Error | string,
  errorCode?: string,
): FailureType | null {
  // Handle string errors by checking error codes

  if (errorCode) {
    const res = classifyByErrorCode(errorCode);
    if (res) {
      return res;
    }
  }

  if (typeof error === 'string') {
    const res = classifyByErrorMessage(error);
    if (res) {
      return res;
    }
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Model-related errors
    if (
      error instanceof ModelProviderError ||
      error instanceof ModelProviderTimeout ||
      error instanceof ModelProviderRateLimitExceeded ||
      error instanceof ModelNotSupportedError ||
      error instanceof ContentTooLargeError ||
      error instanceof PayloadTooLargeError ||
      error instanceof ChatModelNotConfiguredError ||
      error instanceof EmbeddingNotConfiguredError ||
      error instanceof MediaProviderNotConfiguredError ||
      error instanceof MediaModelNotConfiguredError ||
      error instanceof UnknownError
    ) {
      return 'modelCall';
    }

    // Multimodal-related errors
    if (
      error instanceof MediaProviderNotConfiguredError ||
      error instanceof MediaModelNotConfiguredError
    ) {
      return 'modelCall'; // Default to model call
    }

    // Tool-related errors
    if (error instanceof ToolsetNotFoundError) {
      return 'toolCall';
    }

    // Workflow-related errors
    if (error instanceof WorkflowExecutionNotFoundError) {
      return 'workflow';
    }

    // Content filtering errors
    if (error instanceof ContentFilteringError) {
      return 'contentFiltering';
    }

    // Action aborted could be any type, need more context
    if (error instanceof ActionAborted) {
      return 'modelCall'; // Default to model call
    }

    // Credit insufficient is handled separately in failure-notice.tsx
    if (error instanceof ModelUsageQuotaExceeded) {
      return 'modelCall'; // Default to model call
    }

    // System errors that are not classifiable as execution errors
    if (
      error instanceof ConnectionError ||
      error instanceof ParamsError ||
      error instanceof OAuthError ||
      error instanceof AccountNotFoundError ||
      error instanceof PasswordIncorrect ||
      error instanceof EmailAlreadyRegistered ||
      error instanceof InvalidVerificationSession ||
      error instanceof IncorrectVerificationCode ||
      error instanceof OperationTooFrequent ||
      error instanceof AuthenticationExpiredError ||
      error instanceof UnsupportedFileTypeError ||
      error instanceof EmbeddingNotAllowedToChangeError
    ) {
      return null; // These are not execution-related errors
    }

    // Resource not found errors (except toolset and workflow)
    if (
      error instanceof CanvasNotFoundError ||
      error instanceof ResourceNotFoundError ||
      error instanceof DocumentNotFoundError ||
      error instanceof ReferenceNotFoundError ||
      error instanceof ReferenceObjectMissingError ||
      error instanceof SkillNotFoundError ||
      error instanceof LabelClassNotFoundError ||
      error instanceof LabelInstanceNotFoundError ||
      error instanceof ShareNotFoundError ||
      error instanceof PageNotFoundError ||
      error instanceof ActionResultNotFoundError ||
      error instanceof StaticFileNotFoundError ||
      error instanceof CodeArtifactNotFoundError ||
      error instanceof ProjectNotFoundError ||
      error instanceof ProviderNotFoundError ||
      error instanceof ProviderItemNotFoundError ||
      error instanceof McpServerNotFoundError ||
      error instanceof CanvasVersionNotFoundError ||
      error instanceof ProviderMisconfigurationError
    ) {
      return null; // These are resource errors, not execution errors
    }

    // Quota and other errors
    if (error instanceof StorageQuotaExceeded || error instanceof DuplicationNotAllowedError) {
      return null; // These are not execution-related errors
    }
  }

  // Default fallback for unclassified errors
  return 'modelCall';
}

/**
 * Classify error by error code
 */
function classifyByErrorCode(errorCode: string): FailureType | null {
  // Content filtering error - must check before E30xx pattern
  if (errorCode === 'E3007') {
    return 'contentFiltering';
  }

  // Model provider errors (E3xxx)
  if (errorCode.startsWith('E30')) {
    return 'modelCall';
  }

  // Model configuration errors
  if (
    errorCode === 'E0014' ||
    errorCode === 'E0015' ||
    errorCode === 'E0016' ||
    errorCode === 'E0017'
  ) {
    return 'modelCall';
  }

  // Multimodal-related errors
  if (errorCode === 'E0016' || errorCode === 'E0017') {
    return 'multimodal';
  }

  // Tool-related errors
  if (errorCode === 'E1020') {
    return 'toolCall';
  }

  // Workflow-related errors
  if (errorCode === 'E1021') {
    return 'workflow';
  }

  // Content/payload errors
  if (errorCode === 'E2004' || errorCode === 'E2005' || errorCode === 'E0000') {
    return 'modelCall';
  }

  // System errors that are not execution-related
  if (
    errorCode === 'E0001' || // ConnectionError
    errorCode === 'E0003' || // ParamsError
    errorCode === 'E0004' || // OAuthError
    errorCode === 'E0005' || // AccountNotFoundError
    errorCode === 'E0006' || // PasswordIncorrect
    errorCode === 'E0007' || // EmailAlreadyRegistered
    errorCode === 'E0008' || // InvalidVerificationSession
    errorCode === 'E0009' || // IncorrectVerificationCode
    errorCode === 'E0010' || // OperationTooFrequent
    errorCode === 'E0011' || // AuthenticationExpiredError
    errorCode === 'E0012' || // UnsupportedFileTypeError
    errorCode === 'E0013' // EmbeddingNotAllowedToChangeError
  ) {
    return null;
  }

  // Resource not found errors (not execution-related)
  if (
    errorCode === 'E1000' || // CanvasNotFoundError
    errorCode === 'E1002' || // ResourceNotFoundError
    errorCode === 'E1003' || // DocumentNotFoundError
    errorCode === 'E1004' || // ReferenceNotFoundError
    errorCode === 'E1005' || // ReferenceObjectMissingError
    errorCode === 'E1006' || // SkillNotFoundError
    errorCode === 'E1007' || // LabelClassNotFoundError
    errorCode === 'E1008' || // LabelInstanceNotFoundError
    errorCode === 'E1009' || // ShareNotFoundError
    errorCode === 'E1010' || // PageNotFoundError
    errorCode === 'E1011' || // ActionResultNotFoundError
    errorCode === 'E1012' || // StaticFileNotFoundError
    errorCode === 'E1013' || // CodeArtifactNotFoundError
    errorCode === 'E1014' || // ProjectNotFoundError
    errorCode === 'E1015' || // ProviderNotFoundError
    errorCode === 'E1016' || // ProviderItemNotFoundError
    errorCode === 'E1017' || // McpServerNotFoundError
    errorCode === 'E1018' || // CanvasVersionNotFoundError
    errorCode === 'E1019' // ProviderMisconfigurationError
  ) {
    return null;
  }

  // Quota and other errors (not execution-related)
  if (
    errorCode === 'E2001' || // StorageQuotaExceeded
    errorCode === 'E2002' || // ModelUsageQuotaExceeded (handled separately)
    errorCode === 'E2003' || // ModelNotSupportedError
    errorCode === 'E3005' // DuplicationNotAllowedError
  ) {
    return null;
  }

  return null;
}

/**
 * Classify error by error message content
 */
function classifyByErrorMessage(errorMessage: string): FailureType | null {
  const lowerMessage = errorMessage.toLowerCase();

  // Content filtering keywords - check first as they are specific
  if (
    lowerMessage.includes('content filtering') ||
    lowerMessage.includes('content filter') ||
    lowerMessage.includes('output blocked') ||
    lowerMessage.includes('blocked by') ||
    lowerMessage.includes('safety filter') ||
    lowerMessage.includes('content policy') ||
    lowerMessage.includes('content moderation') ||
    lowerMessage.includes('harmful content') ||
    lowerMessage.includes('violates') ||
    lowerMessage.includes('inappropriate content')
  ) {
    return 'contentFiltering';
  }

  // Model-related keywords
  if (
    lowerMessage.includes('model') ||
    lowerMessage.includes('provider') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('content too large') ||
    lowerMessage.includes('payload too large') ||
    lowerMessage.includes('chat model') ||
    lowerMessage.includes('embedding model') ||
    lowerMessage.includes('media model') ||
    lowerMessage.includes('not configured') ||
    lowerMessage.includes('not supported') ||
    lowerMessage.includes('unknown error')
  ) {
    return 'modelCall';
  }

  // Tool-related keywords
  if (
    lowerMessage.includes('tool') ||
    lowerMessage.includes('toolset') ||
    lowerMessage.includes('function call') ||
    lowerMessage.includes('tool not found')
  ) {
    return 'toolCall';
  }

  // Workflow-related keywords
  if (
    lowerMessage.includes('workflow') ||
    lowerMessage.includes('execution') ||
    lowerMessage.includes('node') ||
    lowerMessage.includes('workflow execution not found')
  ) {
    return 'workflow';
  }

  // Multimodal-related keywords
  if (
    lowerMessage.includes('generation') ||
    lowerMessage.includes('image') ||
    lowerMessage.includes('media') ||
    lowerMessage.includes('multimodal') ||
    lowerMessage.includes('media provider') ||
    lowerMessage.includes('media model')
  ) {
    return 'multimodal';
  }

  // System errors that are not execution-related
  if (
    lowerMessage.includes('connection') ||
    lowerMessage.includes('parameter') ||
    lowerMessage.includes('oauth') ||
    lowerMessage.includes('account not found') ||
    lowerMessage.includes('password') ||
    lowerMessage.includes('email') ||
    lowerMessage.includes('verification') ||
    lowerMessage.includes('frequent') ||
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('file type') ||
    lowerMessage.includes('embedding not allowed')
  ) {
    return null;
  }

  // Resource not found errors (not execution-related)
  if (
    lowerMessage.includes('not found') ||
    lowerMessage.includes('missing') ||
    lowerMessage.includes('canvas not found') ||
    lowerMessage.includes('document not found') ||
    lowerMessage.includes('reference not found') ||
    lowerMessage.includes('skill not found') ||
    lowerMessage.includes('project not found') ||
    lowerMessage.includes('provider not found')
  ) {
    return null;
  }

  // Quota and other errors (not execution-related)
  if (
    lowerMessage.includes('quota') ||
    lowerMessage.includes('storage') ||
    lowerMessage.includes('credit') ||
    lowerMessage.includes('duplication not allowed')
  ) {
    return null;
  }

  return null;
}

/**
 * Check if an error should be handled by the credit insufficient component
 */
export function isCreditInsufficientError(
  error: Error | string,
  creditBalance: number,
  isBalanceSuccess: boolean,
): boolean {
  if (typeof error === 'string') {
    return false;
  }

  return error instanceof ModelUsageQuotaExceeded && creditBalance <= 0 && isBalanceSuccess;
}
