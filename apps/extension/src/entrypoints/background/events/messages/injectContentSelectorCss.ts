import { BackgroundMessage } from '@refly/common-types';
import { browser } from 'wxt/browser';

export const handleInjectContentSelectorCss = async (_msg: BackgroundMessage) => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const { id } = tabs[0];

    console.log('currentTabid', id);

    await browser.scripting.executeScript({
      target: { tabId: id as number },
      func: () => {
        const style = document.createElement('style');
        style.setAttribute('data-id', 'refly-selected-mark-injected-css');
        style.textContent = `
            * {
                cursor: default !important;
                  }
                  .refly-content-selector-mark {
                    cursor: pointer !important;
                    background-color: #ffd40024 !important;
                  }
                    
                  input,
                  textarea {
                    pointer-events: none;
                  }

                  .refly-content-selected-target {
                    color: unset !important;
                    border-bottom: 2px solid rgb(255, 212, 0) !important;
                    background-color: #ffd40024 !important;
                    cursor: pointer !important;
                  }

                  [data-refly-inline-selected-mark-id],
                  [data-refly-block-selected-mark-id] {
                    color: unset !important;
                    border-bottom: 2px solid rgb(255, 212, 0) !important;
                  background-color: #ffd40024 !important;
                  cursor: pointer !important;
              }
              `;
        document.head.appendChild(style);
      },
    });
    console.log('Inject content selector style success');
  } catch (err) {
    console.log(`Inject content selector style failed: ${err}`);
  }

  return {
    success: true,
  };
};
