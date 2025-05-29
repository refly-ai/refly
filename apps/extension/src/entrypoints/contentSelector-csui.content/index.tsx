import ReactDOM from 'react-dom/client';
import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { App } from './App';
import { setRuntime } from '@refly/utils/env';
import { logger } from '@/utils/logger';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  excludeMatches: [
    'https://refly.ai/*',
    'https://api.refly.ai/*',
    'https://www.refly.ai/*',
    'http://localhost:5173/*',
  ],

  async main(ctx) {
    setRuntime('extension-csui');
    logger.debug('contentSelector ctx', ctx);

    const injectSelectorCSS = () => {
      const style = document.createElement('style');
      style.setAttribute('data-id', 'refly-selected-mark-injected-css');
      style.textContent = `
        .refly-content-selector-mark {
          cursor: pointer !important;
          background-color: #ffd40024 !important;
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

      return () => {
        document.head.removeChild(style);
      };
    };

    let removeInjectCSS: () => void;
    const ui = await createShadowRootUi(ctx, {
      name: 'refly-content-selector',
      position: 'inline',
      append: 'before',
      onMount(container) {
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        removeInjectCSS = injectSelectorCSS();
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
        removeInjectCSS?.();
      },
    });

    ui.mount();
  },
});
