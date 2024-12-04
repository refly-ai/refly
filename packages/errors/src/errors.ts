import { BaseError } from './base';

export class UnknownError extends BaseError {
  code = 'E0000';
  messageDict = {
    en: 'An unknown error has occurred. The Refly team is working quickly to resolve it. Please try again later.',
    'zh-CN': '出现未知错误，Refly 团队正在火速处理中，请稍后重试。',
  };
}

export class ConnectionError extends BaseError {
  code = 'E0001';
  messageDict = {
    en: 'Cannot connect to the Refly server, please try again later.',
    'zh-CN': '无法连接到 Refly 服务器，请稍后重试。',
  };
}

export class UnauthorizedError extends BaseError {
  code = 'E0002';
  messageDict = {
    en: 'Unauthorized, please login',
    'zh-CN': '未授权，请登录',
  };
}

export class ParamsError extends BaseError {
  code = 'E0003';
  messageDict = {
    en: 'System parameter error. The Refly team is working quickly to address it. Please try again later.',
    'zh-CN': '系统参数错误，Refly 团队正在火速处理中，请稍后重试。',
  };
}

export class OAuthError extends BaseError {
  code = 'E0004';
  messageDict = {
    en: 'Authorization process failed, please try again',
    'zh-CN': '授权过程失败，请重试',
  };
}

export class CanvasNotFoundError extends BaseError {
  code = 'E1000';
  messageDict = {
    en: 'Canvas not found, please refresh',
    'zh-CN': '画布不存在，请刷新重试',
  };
}

export class ProjectNotFoundError extends BaseError {
  code = 'E1001';
  messageDict = {
    en: 'Project not found, please refresh',
    'zh-CN': '项目不存在，请刷新重试',
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

export class ConversationNotFoundError extends BaseError {
  code = 'E1010';
  messageDict = {
    en: 'Thread not found',
    'zh-CN': '会话不存在',
  };
}

export class ActionResultNotFoundError extends BaseError {
  code = 'E1011';
  messageDict = {
    en: 'Action result not found, please refresh',
    'zh-CN': '执行结果不存在，请刷新重试',
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
    en: 'Model usage quota exceeded, please upgrade your subscription',
    'zh-CN': '模型使用额度不足，请升级订阅套餐',
  };
}

export class ModelNotSupportedError extends BaseError {
  code = 'E2003';
  messageDict = {
    en: 'Model not supported, please select other models',
    'zh-CN': '不支持当前模型，请选择其他模型',
  };
}

// Create a mapping of error codes to error classes
const errorMap = {
  E0000: UnknownError,
  E0001: ConnectionError,
  E0002: UnauthorizedError,
  E0003: ParamsError,
  E0004: OAuthError,
  E1000: CanvasNotFoundError,
  E1001: ProjectNotFoundError,
  E1002: ResourceNotFoundError,
  E1003: DocumentNotFoundError,
  E1004: ReferenceNotFoundError,
  E1005: ReferenceObjectMissingError,
  E1006: SkillNotFoundError,
  E1007: LabelClassNotFoundError,
  E1008: LabelInstanceNotFoundError,
  E1009: ShareNotFoundError,
  E1010: ConversationNotFoundError,
  E1011: ActionResultNotFoundError,
  E2001: StorageQuotaExceeded,
  E2002: ModelUsageQuotaExceeded,
  E2003: ModelNotSupportedError,
};

export function getErrorMessage(code: string, locale: string): string {
  const ErrorClass = errorMap[code];
  if (!ErrorClass) {
    return new UnknownError().getMessage(locale);
  }
  return new ErrorClass().getMessage(locale);
}
