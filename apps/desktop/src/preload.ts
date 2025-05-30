import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
  ping: () => ipcRenderer.invoke('ping'),
});

contextBridge.exposeInMainWorld('electronEnv', {
  getApiBaseUrl: () => process.env.RF_API_BASE_URL,
  getCollabUrl: () => process.env.RF_COLLAB_URL,
  getPublicStaticEndpoint: () => process.env.RF_PUBLIC_STATIC_ENDPOINT,
  getPrivateStaticEndpoint: () => process.env.RF_PRIVATE_STATIC_ENDPOINT,
});
