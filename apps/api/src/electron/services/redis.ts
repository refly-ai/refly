import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import getPort from 'get-port';
import { app } from 'electron';

let redisProcess: ChildProcess | null = null;

/**
 * Starts a Redis server on a free port
 * @returns {Promise<number>} The port the Redis server is running on
 */
export const startRedisServer = async (): Promise<number> => {
  // Get a free port for Redis server
  const redisPort = await getPort();
  const redisServerPath = path.join(process.env.APP_ROOT, 'bin', 'redis-server');
  console.log('redisServerPath', redisServerPath);

  // Check if Redis server binary exists
  if (!fs.existsSync(redisServerPath)) {
    console.error(`Redis server binary not found at ${redisServerPath}`);
    throw new Error('Redis server binary not found');
  }

  // Create a temporary Redis config file to set the port
  const tempDir = app.getPath('temp');
  const configPath = path.join(tempDir, 'redis.conf');
  const dataDir = path.join(app.getPath('userData'), 'redis-data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write Redis config
  fs.writeFileSync(
    configPath,
    `port ${redisPort}\ndir "${dataDir}"\ndbfilename dump.rdb\nsave 60 1\n`,
  );

  // Start Redis server with the config file
  redisProcess = spawn(redisServerPath, [configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    if (!redisProcess) {
      return reject(new Error('Failed to start Redis server'));
    }

    let startupError = '';

    // Listen for Redis startup messages
    redisProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`Redis: ${output}`);

      // When Redis reports it's ready to accept connections, resolve with the port
      if (output.includes('Ready to accept connections')) {
        console.log(`Redis server running on port ${redisPort}`);
        resolve(redisPort);
      }
    });

    redisProcess.stderr?.on('data', (data) => {
      const errorOutput = data.toString();
      console.error(`Redis error: ${errorOutput}`);
      startupError += errorOutput;
    });

    redisProcess.on('error', (error) => {
      console.error('Failed to start Redis server:', error);
      reject(error);
    });

    redisProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Redis server exited with code ${code}`);

        // Check for specific error cases
        if (startupError.includes('Address already in use')) {
          // Port conflict - try again with a different port
          console.log('Redis port conflict, retrying with a different port...');
          if (redisProcess) {
            redisProcess = null;
            startRedisServer().then(resolve).catch(reject);
          }
        } else {
          reject(new Error(`Redis server exited with code ${code}: ${startupError}`));
        }
      }
    });

    // Set a timeout in case Redis doesn't start properly
    setTimeout(() => {
      if (redisProcess?.killed === false) {
        console.log("Redis startup timeout reached, assuming it's running");
        resolve(redisPort); // Assume it's running even if we didn't see the "ready" message
      }
    }, 5000);
  });
};

/**
 * Shuts down the Redis server
 */
export const shutdownRedisServer = () => {
  // Clean up Redis process
  if (redisProcess && !redisProcess.killed) {
    console.log('Shutting down Redis server...');
    try {
      process.kill(redisProcess.pid!, 'SIGTERM');
    } catch (err) {
      console.error('Error shutting down Redis server:', err);
    }
    redisProcess = null;
  }
};
