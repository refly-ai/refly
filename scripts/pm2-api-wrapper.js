#!/usr/bin/env node
/**
 * Wrapper run by PM2 for refly-api in development. PM2 monitors this process;
 * this script spawns the real API as a child with IPC. When the child sends
 * "ready", we forward it to PM2 so status becomes "online" only when the app
 * actually listens. When the child exits (crash), we exit with the same code so
 * PM2 shows "errored". PM2's watch restarts this wrapper on file change, so
 * fixing code and saving will bring the app back without an extra watcher app.
 */

const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const API_CWD = path.join(ROOT, 'apps/api');

const GRACEFUL_SHUTDOWN_TIMEOUT = 5000; // 5 seconds

const child = spawn(
  'node',
  ['--trace-warnings', '-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'src/main.ts'],
  {
    cwd: API_CWD,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: { ...process.env, NODE_ENV: 'development' },
  },
);

// Handle child process spawn errors (e.g., node not found, permission denied)
child.on('error', (err) => {
  console.error('Failed to start API child process:', err);
  process.exit(1);
});

child.on('message', (msg) => {
  if (msg === 'ready' && typeof process.send === 'function') {
    process.send('ready');
  }
});

// Track intentional shutdown so signal-based exits use code 0
let isShuttingDown = false;

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? (isShuttingDown ? 0 : 1) : 0));
});

const shutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  child.kill(signal);

  // Force kill if child doesn't exit gracefully within timeout
  const forceKillTimer = setTimeout(() => {
    console.error('Child process did not exit gracefully, forcing kill');
    child.kill('SIGKILL');
  }, GRACEFUL_SHUTDOWN_TIMEOUT);

  // Clear timer if child exits before timeout
  child.once('exit', () => {
    clearTimeout(forceKillTimer);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
