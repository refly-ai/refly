import ReactDOM from 'react-dom/client';
import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { App } from './App';

import { setRuntime } from '@refly/utils/env';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route } from '@refly-packages/ai-workspace-common/utils/router';
import { AppRouter } from '@/routes';
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

    logger.debug('floatingSphere ctx', ctx);
    let _removeInjectCSS: () => void;
    // 3. Define your UI`
    const ui = await createShadowRootUi(ctx, {
      name: 'refly-float-sphere',
      position: 'inline',
      append: 'last',
      onMount(container) {
        // 渲染 selector
        const root = ReactDOM.createRoot(container);
        root.render(
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#00968F',
                borderRadius: 6,
              },
            }}
          >
            <MemoryRouter>
              <AppRouter loadingElement={<div />} loginElement={<div />}>
                <Route path="/" element={<App />} />
                <Route path="/login" element={<div />} />
              </AppRouter>
            </MemoryRouter>
          </ConfigProvider>,
        );

        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    // 4. Mount the UI
    ui.mount();
  },
});
