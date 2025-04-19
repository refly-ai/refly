import '../register-aliases';

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import { shutdownRedisServer, startRedisServer } from './services/redis';
import { startQdrantServer, shutdownQdrantServer } from './services/qdrant';
import { shutdownApiServer, startApiServer } from './services/api';

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = 'http://localhost:5173';
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null;

async function createWindow() {
  console.log('appPath', app.getPath('userData'));
  console.log('systemLocale', app.getSystemLocale());

  try {
    const redisPort = await startRedisServer();
    process.env.REDIS_PORT = String(redisPort);
    console.log(`Redis port set to ${process.env.REDIS_PORT}`);

    const { httpPort: qdrantPort } = await startQdrantServer();
    process.env.QDRANT_PORT = String(qdrantPort);
    console.log(`Qdrant port set to ${process.env.QDRANT_PORT}`);

    await startApiServer();
  } catch (error) {
    console.error('Failed to start services:', error);
  }

  win = new BrowserWindow({
    height: 1080,
    width: 1920,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.session.setPermissionRequestHandler((webContents, _permission, callback) => {
    const url = webContents.getURL();
    if (url.startsWith('http://localhost:') || url.startsWith('https://localhost:')) {
      callback(true);
      return;
    }

    callback(false);
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `connect-src 'self' ${process.env.RF_API_BASE_URL} ws: wss: http://localhost:* https://localhost:*`,
        ],
      },
    });
  });

  ipcMain.handle('getRedisUrl', () => {
    return process.env.REDIS_URL;
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.commandLine.appendSwitch('ignore-certificate-errors');

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// Clean up on app quit
app.on('quit', async () => {
  shutdownRedisServer();
  shutdownQdrantServer();

  await shutdownApiServer();
});
