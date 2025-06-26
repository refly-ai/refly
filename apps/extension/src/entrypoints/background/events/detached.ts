import { Tabs } from 'wxt/browser';
import { logger } from '../../../utils/logger';

export const onDetached = (tabId: number, detachInfo: Tabs.OnDetachedDetachInfoType) => {
  // 在此处处理标签切换
  logger.debug(`Tab with ID ${tabId} was detached in window ${detachInfo.oldWindowId}`);
};
