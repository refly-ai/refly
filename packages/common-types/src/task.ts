import { type OutputLocale } from './i18n';
import { Source } from '@refly/openapi-schema';

export interface Mode {
  id: string;
  icon: any;
  text: string;
  prompt: string;
}

export enum TASK_STATUS {
  // 前端 task
  START = 'start',
  SHUTDOWN = 'shutdown',
}

export enum TASK_TYPE {
  // 和服务端调通的 task
  CHAT = 'chat',
  GEN_TITLE = 'genTitle',
  QUICK_ACTION = 'quickAction',
  SEARCH_ENHANCE_KEYWORD = 'searchEnhanceKeyword',
  SEARCH_ENHANCE_SUMMARIZE = 'searchEnhanceSummarize',
  SEARCH_ENHANCE_ASK = 'searchEnhanceAsk',
}

export enum LANGUAGE {
  AUTO = 'auto',
}

export enum QUICK_ACTION_TYPE {
  SELECTION = 'selection',
  SUMMARY = 'summary', // 用作总结内容
}

export type GEN_TITLE = {
  convId: string;
};

export type QUICK_ACTION_TASK_PAYLOAD = {
  question?: string; // 用户问题

  actionType?: QUICK_ACTION_TYPE;
  actionPrompt?: string;
  reference?: string;
  convId?: string;
  filter?: {
    // 限制用于 quick-action 的网页列表
    weblinkList?: Source[];
    urls?: string[];
    resourceIds?: string[];
    collectionIds?: string[];
  };
};

export type SEARCH_RESULT_ITEM = {
  title: string;
  url: string;
  desc: string;
};

export type SEARCH_ENHANCE = {
  keyword: string;
  items: SEARCH_RESULT_ITEM[];
  isManual: boolean;
};

export type CHAT = {
  question: string;
  convId?: string;
  filter?: {
    // 限制召回网页的 filter
    weblinkList?: Source[];
    urls?: string[];
    resourceIds?: string[];
    collectionIds?: string[];
  };
};

export interface CreateConversationParam {
  contentId?: number;
  linkId?: string; // 创建会话基于的 linkId
  title?: string;
  origin?: string; // 创建会话的 origin
  originPageUrl?: string; // 创建会话的 url
  originPageTitle?: string; // 所在 url 的 page title
  locale?: string; // 语言设置
}

export type Task = {
  convId: string;
  dryRun?: boolean; // 不关联任何对话
  taskType: TASK_TYPE;
  taskId?: string; // task:xxxx-xxxx-xxxx-xxxx
  createConvParam?: CreateConversationParam; // 创建新对话的参数
  language?: LANGUAGE;
  locale?: OutputLocale;
  data?: CHAT | QUICK_ACTION_TASK_PAYLOAD;
};

//如何把TASK_TYPE和data关联起来
