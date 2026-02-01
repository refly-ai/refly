// Some injects
import './process-polyfill';
import './utils/dom-patch';
import './index.css';
import './tokens.css';
import './antd-overrides.css';
import './audio-controls.css';

import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@refly-packages/ai-workspace-common/utils/request';
import { App } from './App';
import { initServiceWorker } from './service-worker';

// Initialize Service Worker (includes registration and message handling)
initServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
