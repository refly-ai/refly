import { Tabs } from 'wxt/browser';

export const onDetached = (tabId: number, detachInfo: Tabs.OnDetachedDetachInfoType) => {
  // 在此处处理标签切换
  console.log(`Tab with ID ${tabId} was detached in window ${detachInfo.oldWindowId}`);
};
