import { sendHeartBeatMessage } from './utils';
import { Tabs } from 'wxt/browser';

export const onActivated = (activeInfo: Tabs.OnActivatedActiveInfoType) => {
  // 在此处处理标签切换
  console.log(`Tab with ID ${activeInfo.tabId} was activated in window ${activeInfo.windowId}`);

  sendHeartBeatMessage(activeInfo);
};
