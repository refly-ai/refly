import { useEffect, useRef } from 'react';
import { sendMessage } from '@refly-packages/ai-workspace-common/utils/extension/messaging';
import { getRuntime } from '@refly/utils/env';
import pTimeout from 'p-timeout';
import { checkPageUnsupported } from '@refly-packages/ai-workspace-common/utils/extension/check';
import { checkBrowserArc } from '@/utils/browser';
import { useCopilotTypeStore } from '@/modules/toggle-copilot/stores/use-copilot-type';

export const useToggleCopilot = () => {
  const { copilotType } = useCopilotTypeStore((state) => ({
    copilotType: state.copilotType,
  }));
  const isDomVisibilityRef = useRef<'visible' | 'hidden'>(document.visibilityState);

  const isCopilotOpenRef = useRef<boolean>();
  const isArcBrowserRef = useRef<boolean>();

  const handleToggleCopilot = async (isOpen = false) => {
    // with action, always open, toggle selector, and notify toggle status
    const isCopilotOpen = isCopilotOpenRef.current;
    isCopilotOpenRef.current = !isCopilotOpen;

    await handleCheckArcBrowser();

    console.log('isArcBrowserRef.current', isArcBrowserRef.current, isCopilotOpen);
    if (isArcBrowserRef.current) {
      console.log('sendMessage', 'toggleCopilotSidePanel');
      sendMessage({
        type: 'others',
        name: 'toggleCopilotCSUI',
        body: {
          isArcBrowser: isArcBrowserRef.current,
          isCopilotOpen: isOpen ? true : !isCopilotOpen,
        },
        source: getRuntime(),
      });
    } else {
      console.log('sendMessage', 'toggleCopilotSidePanel');
      sendMessage({
        type: 'toggleCopilot',
        name: 'toggleCopilotSidePanel',
        body: {
          isArcBrowser: isArcBrowserRef.current,
          isCopilotOpen: isOpen ? true : !isCopilotOpen,
        },
        source: getRuntime(),
      });
    }
  };

  /**
   * 1. 检查是否是 arc 浏览器标签
   * 2. 是，则打开 content script ui，否则打开 sidePanel
   * 3. 直接发送 toggleSidePanel
   */
  const handleCheckArcBrowser = async () => {
    if (!checkPageUnsupported(window.location.href)) {
      const isArc = await checkBrowserArc();
      isArcBrowserRef.current = isArc;
    }
  };

  // initial check side panel open status
  const handleCheckSidePanelOpenStatus = async () => {
    try {
      const result = await pTimeout(
        sendMessage({
          type: 'others',
          name: 'checkSidePanelOpenStatus',
          source: getRuntime(),
        }),
        { milliseconds: 1000 },
      );
      isCopilotOpenRef.current = result?.isCopilotOpen ?? false;
      return result;
    } catch (error) {
      console.error(`checkSidePanelOpenStatus error: ${error}`);
      isCopilotOpenRef.current = false;
      return false;
    }
  };

  const handleVisibilityChange = () => {
    isDomVisibilityRef.current = document.visibilityState;
  };

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  useEffect(() => {
    console.log('useToggleCopilot copilotType', copilotType);
    //

    // Initial check if the page is already visible
    if (
      isDomVisibilityRef.current === 'visible' &&
      !copilotType &&
      !checkPageUnsupported(window.location.href)
    ) {
      handleCheckArcBrowser();
      handleCheckSidePanelOpenStatus();
    }
  }, [copilotType]);

  return {
    handleToggleCopilot,
  };
};
