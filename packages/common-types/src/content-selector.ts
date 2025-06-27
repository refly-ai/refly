import { SearchDomain } from '@refly/openapi-schema';
import { SyncMarkEventName } from './extension-messaging';

export type MarkScope = 'block' | 'inline';

export type TextType = 'text' | 'table' | 'link' | 'image' | 'video' | 'audio';
export type FrontendBaseMarkType = 'extensionWeblink' | 'all';
export type BaseMarkType = FrontendBaseMarkType | SearchDomain;

export const frontendBaseMarkTypes: BaseMarkType[] = ['extensionWeblink', 'all'];
export const backendBaseMarkTypes: BaseMarkType[] = ['document', 'resource']; // conversation and skill not supported yet

export type SelectedTextMarkType =
  | 'resourceSelection'
  | 'documentSelection'
  | 'extensionWeblinkSelection';
// for notion cursor selection, mainly for note-related skills
export type SelectedCursorTextMarkType =
  | 'documentCursorSelection'
  | 'documentBeforeCursorSelection'
  | 'documentAfterCursorSelection';

/**
 * 1. extension-weblink: represent the weblink in the extension
 * 2. noteCursor: represent the note cursor related selection
 */
export const selectedTextDomains: SelectedTextDomain[] = [
  'resourceSelection',
  'documentSelection',
  'extensionWeblinkSelection',
  'documentCursorSelection',
  'documentBeforeCursorSelection',
  'documentAfterCursorSelection',
];

// selected text card domain
export type SelectedTextDomain = SelectedTextMarkType | SelectedCursorTextMarkType;

// 最后，将 MarkType 定义为 BaseMarkType 和 SelectedTextDomain 的联合
export type MarkType = BaseMarkType | SelectedTextDomain;

// extend mark to unify selected text and database entity
export interface Mark {
  id?: string; // unique id
  entityId?: string; // if has entity id, it means it is a database entity
  title?: string; // entity name, include extensionWeblink
  url?: string | (() => string) | (() => void); // entity url, include extensionWeblink
  type: MarkType; // 类型
  name?: string; // mark name
  active?: boolean; // mark active
  textType?: TextType; // 内容类型
  data: string;
  target?: HTMLElement;
  xPath?: string; // 该元素对应的 xPath 路径，这个可以当做唯一 id
  scope?: MarkScope; // 是块级还是内联元素
  domain?: SelectedTextDomain; // 该元素对应的 domain, for selected text card
  cleanup?: () => void; // 清理函数
  icon?: any; // React.ReactNode; // 图标, 理论上应该逻辑和 UI 分离，但是目前为了方便，还是放在一起
  onlyForCurrentContext?: boolean; // 只是当前上下文使用
  isCurrentContext?: boolean; // 是否是当前上下文
  metadata?: Record<string, any>; // TODO: 元数据，用于添加额外的元数据，比如 canvas 的 projectId
  parentId?: string; // 父级 id 比如  documentSelection 的 parentId 是 docId, resourceSelection 的 parentId 是 resourceId
  projectId?: string; // 项目 id
}

export type SyncMarkEventType = 'add' | 'remove' | 'reset';

export interface SyncMarkEvent {
  name: SyncMarkEventName; //'syncMarkEvent' | 'syncMarkEventBack';
  body: {
    type: SyncMarkEventType;
    mark?: Mark;
    content?: string;
  };
}

export type SyncStatusEventType = 'start' | 'update' | 'stop' | 'reset';

export interface SyncStatusEvent {
  name: SyncMarkEventName;
  body: {
    type: SyncStatusEventType;
    scope: MarkScope;
    enableMultiSelect?: boolean;
    showContentSelector?: boolean;
  };
}
