import { storage } from '@refly-packages/ai-workspace-common/utils/storage';
import { Runtime } from 'wxt/browser';

import { setToken } from '../index';

export const onExternalMessage = async (
  msg: any,
  _sender: Runtime.MessageSender,
  _sendResponse: (response?: any) => void,
) => {
  console.log('onMessageExternal msg', msg);
  if (msg?.name === 'external-refly-login-notify') {
    setToken(msg?.body?.token);
    await storage.setItem('sync:refly-login-notify', JSON.stringify({ login: true }));
  }

  if (msg?.name === 'external-refly-logout-notify') {
    setToken('');
    await storage.setItem('sync:refly-login-notify', JSON.stringify({ login: false }));
  }
};
