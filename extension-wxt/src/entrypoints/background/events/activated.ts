import { Tabs } from "wxt/browser";

export const onActivated = (activeInfo: Tabs.OnActivatedActiveInfoType) => {
  // 在此处处理标签切换
  console.log(
    "Tab with ID " +
      activeInfo.tabId +
      " was activated in window " +
      activeInfo.windowId
  );

  // 给 tab 发消息，进行 userProfile 检查，包括更新 i18n 和登录状态
  browser.tabs.sendMessage(activeInfo.tabId, {
    name: "refly-status-check",
  });
};
