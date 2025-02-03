import { BackgroundMessage } from '@refly/common-types';
import { browser, Runtime } from 'wxt/browser';

// 只处理打开的场景，关闭场景 floatSphere CSUI -> sidePanel 自动会处理
export const handleToggleCopilotSidePanel = (
  msg: BackgroundMessage,
  sender: Runtime.MessageSender,
) => {
  try {
    // 获取当前浏览器标签页
    const { isCopilotOpen } = msg.body;
    const windowId = sender?.tab?.windowId;

    if (isCopilotOpen) {
      // only for chrome
      // @ts-ignore
      browser?.sidePanel?.open?.({
        windowId: windowId ?? browser.windows.WINDOW_ID_CURRENT,
      });
    }
  } catch (error) {
    console.error('handleToggleCopilot error: ', error);
  }
};
