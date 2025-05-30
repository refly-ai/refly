import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log/main';
import { prepareEnvironment } from './runtime';

// Set up environment variables BEFORE importing @refly/api
// This ensures environment variables are set properly before any modules are loaded
prepareEnvironment();

import { startApiServerForElectron, shutdownApiServer } from '@refly/api';
import { runPrismaCommand } from './prisma';

// Optional, initialize the logger for any renderer process
log.initialize();

log.info(`Starting Refly Desktop Application, app root: ${app.getAppPath()}`);

let servicesStarted = false;

async function showErrorDialog(error: any) {
  await dialog.showMessageBox({
    type: 'error',
    title: 'Application Startup Error',
    message: 'Failed to start required services',
    detail: `Error: ${
      error instanceof Error ? error.message : String(error)
    }\n\nThe application cannot continue without these services.`,
    buttons: ['Exit'],
    defaultId: 0,
  });

  app.quit();
}

async function prepareDatabase() {
  const prismaRoot = app.isPackaged
    ? path.join(app.getAppPath().replace('app.asar', ''), 'prisma')
    : path.join(app.getAppPath(), 'node_modules', '@refly', 'api', 'prisma');
  const prismaSchemaPath = path.join(prismaRoot, 'sqlite-schema.prisma');
  log.info('Prisma schema path', prismaSchemaPath);

  if (!fs.existsSync(prismaSchemaPath)) {
    throw new Error(`Prisma schema path does not exist: ${prismaSchemaPath}`);
  }

  // TODO: Cache the migration result to optimize launch time
  log.info('Running Prisma database migration');
  await runPrismaCommand({
    command: ['db', 'push', '--skip-generate', `--schema=${prismaSchemaPath}`],
    dbUrl: process.env.DATABASE_URL,
  });
  log.info('Prisma database migration completed successfully');
}

async function startServices() {
  if (servicesStarted) {
    log.info('Services already started, skipping');
    return;
  }

  log.info('Starting API server...');
  await Promise.race([
    startApiServerForElectron(log),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('API server startup timeout')), 30000),
    ),
  ]);

  servicesStarted = true;
  log.info('All services started successfully');
}

const createWindow = async () => {
  try {
    // Prepare database and perform migrations
    await prepareDatabase();

    // Start services before creating window
    await startServices();
  } catch (error) {
    await showErrorDialog(error);
  }

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  } else {
    const viteDevServerURL = 'http://localhost:5173';
    win.loadURL(viteDevServerURL);
  }
};

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong');
  createWindow().catch((error) => {
    log.error('Failed to create window when ready:', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow().catch((error) => {
        log.error('Failed to create window when ready:', error);
        app.quit();
      });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up on app quit
app.on('quit', async () => {
  await shutdownApiServer(log);
});
