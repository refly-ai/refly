import { sendHeartBeatMessage } from './utils';
import { Tabs } from 'wxt/browser';
import { logger } from '../../../utils/logger';

export const onActivated = (activeInfo: Tabs.OnActivatedActiveInfoType) => {
  // 在此处处理标签切换
  logger.debug(`Tab with ID ${activeInfo.tabId} was activated in window ${activeInfo.windowId}`);

  sendHeartBeatMessage(activeInfo);
};
