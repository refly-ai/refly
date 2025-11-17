import { BaseError } from './base';

export class UnknownError extends BaseError {
  code = 'E0000';
  messageDict = {
    en: 'An unknown error has occurred. Please try again later.',
    'zh-CN': '出现未知错误，请稍后重试。',
  };
}

export class ConnectionError extends BaseError {
  code = 'E0001';
  messageDict = {
    en: 'Cannot connect to the server, please try again later.',
    'zh-CN': '无法连接到服务器，请稍后重试。',
  };
}

export class ParamsError extends BaseError {
  code = 'E0003';
  messageDict = {
    en: 'System parameter error. Please try again later.',
    'zh-CN': '系统参数错误，请稍后重试。',
  };
}

export class OAuthError extends BaseError {
  code = 'E0004';
  messageDict = {
    en: 'Authorization process failed, please try again',
    'zh-CN': '授权过程失败，请重试',
  };
}

export class AccountNotFoundError extends BaseError {
  code = 'E0005';
  messageDict = {
    en: 'Account not found, please sign up',
    'zh-CN': '账户不存在，请注册',
  };
}

export class PasswordIncorrect extends BaseError {
  code = 'E0006';
  messageDict = {
    en: 'Password incorrect, please try again',
    'zh-CN': '密码错误，请重试',
  };
}

export class EmailAlreadyRegistered extends BaseError {
  code = 'E0007';
  messageDict = {
    en: 'Email already registered, please sign in or try another one',
    'zh-CN': '邮箱已被注册，请登录或尝试其他邮箱',
  };
}

export class InvalidVerificationSession extends BaseError {
  code = 'E0008';
  messageDict = {
    en: 'Verification session not found or expired, please try again',
    'zh-CN': '验证会话不存在或已过期，请重试',
  };
}

export class IncorrectVerificationCode extends BaseError {
  code = 'E0009';
  messageDict = {
    en: 'Verification code is incorrect, please try again',
    'zh-CN': '验证码错误，请重试',
  };
}

export class OperationTooFrequent extends BaseError {
  code = 'E0010';
  messageDict = {
    en: 'Operation too frequent, please try again later',
    'zh-CN': '操作过于频繁，请稍后再试',
  };
}

export class AuthenticationExpiredError extends BaseError {
  code = 'E0011';
  messageDict = {
    en: 'Authentication expired, please sign in again',
    'zh-CN': '身份验证已过期，请重新登录',
  };
}

export class UnsupportedFileTypeError extends BaseError {
  code = 'E0012';
  messageDict = {
    en: 'This file type is temporarily not supported',
    'zh-CN': '暂不支持该文件类型',
  };
}

export class EmbeddingNotAllowedToChangeError extends BaseError {
  code = 'E0013';
  messageDict = {
    en: 'Switching embedding model is not supported temporarily',
    'zh-CN': '暂不支持切换嵌入模型',
  };
}

export class ChatModelNotConfiguredError extends BaseError {
  code = 'E0014';
  messageDict = {
    en: 'Chat model not configured, please configure a chat model in the settings',
    'zh-CN': '未配置对话模型，请先在设置中进行配置',
  };
}

export class EmbeddingNotConfiguredError extends BaseError {
  code = 'E0015';
  messageDict = {
    en: 'Embedding model not configured, please configure an embedding model in the settings',
    'zh-CN': '未配置嵌入模型，请先在设置中进行配置',
  };
}

export class MediaProviderNotConfiguredError extends BaseError {
  code = 'E0016';
  messageDict = {
    en: 'Media provider not configured, please configure a media provider in the settings',
    'zh-CN': '未配置媒体提供方，请先在设置中进行配置',
  };
}

export class MediaModelNotConfiguredError extends BaseError {
  code = 'E0017';
  messageDict = {
    en: 'Media model not configured, please configure a media model in the settings',
    'zh-CN': '未配置媒体模型，请先在设置中进行配置',
  };
}

export class CanvasNotFoundError extends BaseError {
  code = 'E1000';
  messageDict = {
    en: 'Canvas not found, please refresh',
    'zh-CN': '画布不存在，请刷新重试',
  };
}

export class ResourceNotFoundError extends BaseError {
  code = 'E1002';
  messageDict = {
    en: 'Resource not found, please refresh',
    'zh-CN': '资源不存在，请刷新重试',
  };
}

export class DocumentNotFoundError extends BaseError {
  code = 'E1003';
  messageDict = {
    en: 'Document not found, please refresh',
    'zh-CN': '文档不存在，请刷新重试',
  };
}

export class ReferenceNotFoundError extends BaseError {
  code = 'E1004';
  messageDict = {
    en: 'Reference not found, please refresh',
    'zh-CN': '引用不存在，请刷新重试',
  };
}

export class ReferenceObjectMissingError extends BaseError {
  code = 'E1005';
  messageDict = {
    en: 'Reference object missing, please refresh',
    'zh-CN': '引用对象不存在，请刷新重试',
  };
}

export class SkillNotFoundError extends BaseError {
  code = 'E1006';
  messageDict = {
    en: 'Skill not found, please refresh',
    'zh-CN': '技能不存在，请刷新重试',
  };
}

export class LabelClassNotFoundError extends BaseError {
  code = 'E1007';
  messageDict = {
    en: 'Label class not found, please refresh',
    'zh-CN': '标签分类不存在，请刷新重试',
  };
}

export class LabelInstanceNotFoundError extends BaseError {
  code = 'E1008';
  messageDict = {
    en: 'Label instance not found, please refresh',
    'zh-CN': '标签不存在，请刷新重试',
  };
}

export class ShareNotFoundError extends BaseError {
  code = 'E1009';
  messageDict = {
    en: 'Share content not found',
    'zh-CN': '分享内容不存在',
  };
}

export class PageNotFoundError extends ShareNotFoundError {
  code = 'E1010';
  messageDict = {
    en: 'Page not found',
    'zh-CN': '页面不存在',
  };
}

export class ActionResultNotFoundError extends BaseError {
  code = 'E1011';
  messageDict = {
    en: 'Action result not found, please refresh',
    'zh-CN': '执行结果不存在，请刷新重试',
  };
}

export class StaticFileNotFoundError extends BaseError {
  code = 'E1012';
  messageDict = {
    en: 'Upload file not found, please try again',
    'zh-CN': '上传文件不存在，请重新尝试',
  };
}

export class CodeArtifactNotFoundError extends BaseError {
  code = 'E1013';
  messageDict = {
    en: 'Code artifact not found, please refresh',
    'zh-CN': '代码组件不存在，请刷新重试',
  };
}

export class ProjectNotFoundError extends BaseError {
  code = 'E1014';
  messageDict = {
    en: 'Project not found, please refresh',
    'zh-CN': '项目不存在，请刷新重试',
  };
}

export class ProviderNotFoundError extends BaseError {
  code = 'E1015';
  messageDict = {
    en: 'Provider not found, please refresh',
    'zh-CN': '提供方不存在，请刷新重试',
  };
}

export class ProviderItemNotFoundError extends BaseError {
  code = 'E1016';
  messageDict = {
    en: 'Provider item not found, please refresh',
    'zh-CN': '提供方项目不存在，请刷新重试',
  };
}

export class McpServerNotFoundError extends BaseError {
  code = 'E1017';
  messageDict = {
    en: 'MCP server not found, please refresh',
    'zh-CN': 'MCP 服务器不存在，请刷新重试',
  };
}

export class CanvasVersionNotFoundError extends BaseError {
  code = 'E1018';
  messageDict = {
    en: 'Canvas version not found, please refresh',
    'zh-CN': '画布版本不存在，请刷新重试',
  };
}

export class ProviderMisconfigurationError extends BaseError {
  code = 'E1019';
  messageDict = {
    en: 'Provider misconfiguration, please check the provider configuration',
    'zh-CN': '提供方配置错误，请检查提供方配置',
  };
}

export class ToolsetNotFoundError extends BaseError {
  code = 'E1020';
  messageDict = {
    en: 'Toolset not found, please refresh',
    'zh-CN': '工具集不存在，请刷新重试',
  };
}

export class WorkflowExecutionNotFoundError extends BaseError {
  code = 'E1021';
  messageDict = {
    en: 'Workflow execution not found, please refresh',
    'zh-CN': '工作流执行不存在，请刷新重试',
  };
}

export class WorkflowAppNotFoundError extends BaseError {
  code = 'E1022';
  messageDict = {
    en: 'Workflow app not found, please refresh',
    'zh-CN': '工作流 App 不存在，请刷新重试',
  };
}

export class CopilotSessionNotFoundError extends BaseError {
  code = 'E1023';
  messageDict = {
    en: 'Copilot session not found, please refresh',
    'zh-CN': 'Copilot 会话不存在，请刷新重试',
  };
}

export class DriveFileNotFoundError extends BaseError {
  code = 'E1024';
  messageDict = {
    en: 'Drive file not found, please refresh',
    'zh-CN': '云盘文件不存在，请刷新重试',
  };
}

export class StorageQuotaExceeded extends BaseError {
  code = 'E2001';
  messageDict = {
    en: 'Storage quota exceeded, please upgrade your subscription',
    'zh-CN': '存储容量不足，请升级订阅套餐',
  };
}

export class ModelUsageQuotaExceeded extends BaseError {
  code = 'E2002';
  messageDict = {
    en: 'Execution failed, credit quota insufficient, please upgrade your subscription',
    'zh-CN': '执行失败，积分额度不足，请升级订阅套餐',
  };
}

export class ModelNotSupportedError extends BaseError {
  code = 'E2003';
  messageDict = {
    en: 'Model not supported, please select other models',
    'zh-CN': '不支持当前模型，请选择其他模型',
  };
}

export class ContentTooLargeError extends BaseError {
  code = 'E2004';
  messageDict = {
    en: 'Content is too large. Maximum length is 100k characters.',
    'zh-CN': '内容过长。最大长度为 10 万字符。',
  };
}

export class PayloadTooLargeError extends BaseError {
  code = 'E2005';
  messageDict = {
    en: 'Request payload is too large. Maximum size is 100KB.',
    'zh-CN': '请求数据过大。最大大小为 100KB。',
  };
}

export class ModelProviderError extends BaseError {
  code = 'E3001';
  messageDict = {
    en: 'Model provider error, please try again later',
    'zh-CN': '模型提供方出错，请稍后重试',
  };
}

export class ModelProviderRateLimitExceeded extends BaseError {
  code = 'E3002';
  messageDict = {
    en: 'Request rate limit exceeded for the model provider. Please try again later.',
    'zh-CN': '已超出模型提供方请求速率限制，请稍后重试',
  };
}

export class ModelProviderTimeout extends BaseError {
  code = 'E3003';
  messageDict = {
    en: 'Model provider timed out, please try again later',
    'zh-CN': '模型提供方响应超时，请稍后重试',
  };
}

export class ActionAborted extends BaseError {
  code = 'E3004';
  messageDict = {
    en: 'Action was stopped',
    'zh-CN': '操作已被停止',
  };
}

export class DuplicationNotAllowedError extends BaseError {
  code = 'E3005';
  messageDict = {
    en: 'Duplication is not allowed for this shared content',
    'zh-CN': '此共享内容不允许被复制',
  };
}

// Create a mapping of error codes to error classes
const errorMap = {
  E0000: UnknownError,
  E0001: ConnectionError,
  E0003: ParamsError,
  E0004: OAuthError,
  E0005: AccountNotFoundError,
  E0006: PasswordIncorrect,
  E0007: EmailAlreadyRegistered,
  E0008: InvalidVerificationSession,
  E0009: IncorrectVerificationCode,
  E0010: OperationTooFrequent,
  E0011: AuthenticationExpiredError,
  E0012: UnsupportedFileTypeError,
  E0013: EmbeddingNotAllowedToChangeError,
  E0014: ChatModelNotConfiguredError,
  E0015: EmbeddingNotConfiguredError,
  E0016: MediaProviderNotConfiguredError,
  E0017: MediaModelNotConfiguredError,
  E1000: CanvasNotFoundError,
  E1002: ResourceNotFoundError,
  E1003: DocumentNotFoundError,
  E1004: ReferenceNotFoundError,
  E1005: ReferenceObjectMissingError,
  E1006: SkillNotFoundError,
  E1007: LabelClassNotFoundError,
  E1008: LabelInstanceNotFoundError,
  E1009: ShareNotFoundError,
  E1010: PageNotFoundError,
  E1011: ActionResultNotFoundError,
  E1012: StaticFileNotFoundError,
  E1013: CodeArtifactNotFoundError,
  E1014: ProjectNotFoundError,
  E1015: ProviderNotFoundError,
  E1016: ProviderItemNotFoundError,
  E1017: McpServerNotFoundError,
  E1018: CanvasVersionNotFoundError,
  E1019: ProviderMisconfigurationError,
  E1020: ToolsetNotFoundError,
  E1021: WorkflowExecutionNotFoundError,
  E1022: WorkflowAppNotFoundError,
  E1023: CopilotSessionNotFoundError,
  E1024: DriveFileNotFoundError,
  E2001: StorageQuotaExceeded,
  E2002: ModelUsageQuotaExceeded,
  E2003: ModelNotSupportedError,
  E2004: ContentTooLargeError,
  E2005: PayloadTooLargeError,
  E3001: ModelProviderError,
  E3002: ModelProviderRateLimitExceeded,
  E3003: ModelProviderTimeout,
  E3004: ActionAborted,
  E3005: DuplicationNotAllowedError,
};

export function getErrorMessage(code: string, locale: string): string {
  const ErrorClass = errorMap[code as keyof typeof errorMap];
  if (!ErrorClass) {
    return new UnknownError().getMessage(locale);
  }
  return new ErrorClass().getMessage(locale);
}
