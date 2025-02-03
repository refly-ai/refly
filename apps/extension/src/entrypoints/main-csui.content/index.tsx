import { defineContentScript } from 'wxt/sandbox';
import { setRuntime } from '@refly/utils/env';

export default defineContentScript({
  matches: ['<all_urls>'],
  // 2. Set cssInjectionMode
  cssInjectionMode: 'ui',

  async main() {
    setRuntime('extension-csui');
    // console.log('ctx', ctx);
    // 3. Define your UI`
    // const ui = await createShadowRootUi(ctx, {
    //   name: 'refly-main-app',
    //   position: 'inline',
    //   append: 'before',
    //   onMount(container) {
    //     const root = ReactDOM.createRoot(container);
    //     root.render(
    //       <MemoryRouter>
    //         <App />
    //       </MemoryRouter>,
    //     );
    //     return root;
    //   },
    //   onRemove: (root) => {
    //     root?.unmount();
    //   },
    // });
    // // 4. Mount the UI
    // ui.mount();
  },
});
