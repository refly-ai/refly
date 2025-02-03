import { sendMessage } from '@refly-packages/ai-workspace-common/utils/extension/messaging';
import { BackgroundMessage } from '@refly/common-types';
import { browser } from 'wxt/browser';

export const handleGetOpenedTabs = async (_msg: BackgroundMessage) => {
  try {
    // 获取当前浏览器标签页
    const tabs = await browser.tabs.query({ currentWindow: true });
    const mappedTabs = tabs.map((item) => ({
      title: item.title,
      url: item.url,
      id: item.id,
    }));

    console.log('mappedTabs', mappedTabs);
    sendMessage({
      name: 'getOpenedTabs',
      type: 'others',
      body: {
        tabs: mappedTabs,
      },
      source: 'extension-background',
    });
  } catch (error) {
    console.error(error);
  }

  return {
    success: false,
  };
};
