import { defineContentScript } from 'wxt/sandbox';
import ReactDOM from 'react-dom/client';

import { setRuntime } from '@refly/utils/env';
import { createShadowRootUi } from 'wxt/client';
import App from './App';
import { logger } from '@/utils/logger';

export default defineContentScript({
  matches: ['<all_urls>'],
  // 2. Set cssInjectionMode
  cssInjectionMode: 'ui',
  excludeMatches: [
    'https://refly.ai/*',
    'https://api.refly.ai/*',
    'https://www.refly.ai/*',
    'http://localhost:5173/*',
  ],

  async main(ctx) {
    setRuntime('extension-csui');

    logger.debug('utils-csui ctx', ctx);
    // 3. Define your UI`
    const ui = await createShadowRootUi(ctx, {
      name: 'refly-utils-app',
      position: 'inline',
      append: 'before',
      onMount(container) {
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    // // 4. Mount the UI
    ui.mount();
  },
});
