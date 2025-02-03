import { BackgroundMessage } from '@refly/common-types';
import { browser } from 'wxt/browser';

let isSetSidePanel: boolean | undefined;
export const handleRegisterSidePanel = async (msg: BackgroundMessage) => {
  console.log('handleRegisterSidePanel', msg);

  if (msg?.body?.isArc) {
    const path = browser.runtime.getURL('/popup.html');
    browser.action.onClicked.addListener(async () => {
      console.log('action click');
      browser.action.openPopup();
    });
    browser.action.setPopup({ popup: path });
    console.log('register popup success');
  } else {
    if (typeof isSetSidePanel === 'boolean' && isSetSidePanel) {
      return;
    }
    isSetSidePanel = true;
    // @ts-ignore
    browser?.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .then(() => {
        console.log('register sidePanel success');
      })
      .catch((error: any) => console.error('sidePanel open error: ', error));
  }
};

export const handleUnregisterSidePanel = async (_msg: BackgroundMessage) => {
  // @ts-ignore
  browser?.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .then(() => {
      console.log('unregister sidePanel success');
    })
    .catch((error: any) => console.error('sidePanel unregister error: ', error));
};

export const handleRegisterEvent = async (msg: BackgroundMessage) => {
  if (msg?.name === 'registerSidePanel') {
    handleRegisterSidePanel(msg);
  }

  if (msg?.name === 'unregisterSidePanel') {
    handleUnregisterSidePanel(msg);
  }
};
