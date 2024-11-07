import { CanvasIntentType } from '@refly/common-types';

export enum MessageIntentSource {
  HomePage = 'homePage', // for qa and generateCanvas
  Sider = 'sider', // for jump to conversation detail
  SkillJob = 'skillJob', // for qa
  ConversationList = 'conversationList', // for qa, generateCanvas
  ConversationDetail = 'conversationDetail', // for qa, generateCanvas
  Project = 'project', // for qa, rewriteCanvas, generateCanvas
  Resource = 'resource', // for qa and generateCanvas
  ResourceQuickAction = 'resourceQuickAction', // for qa and generateCanvas
  Share = 'share', // for qa and generateCanvas
  Canvas = 'canvas', // for edit and qa
  Search = 'search', // for qa
  AISelector = 'aiSelector', // for editor
}

export interface NavigationContext {
  source: MessageIntentSource;
  shouldFetchDetail: boolean;
  intentType?: CanvasIntentType;
  clearSearchParams?: boolean;
}
