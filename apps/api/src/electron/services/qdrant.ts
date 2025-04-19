import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import getPort from 'get-port';
import { app } from 'electron';

let qdrantProcess: ChildProcess | null = null;

/**
 * Starts a Qdrant server on a free port
 * @returns {Promise<{httpPort: number, grpcPort: number}>} The ports the Qdrant server is running on
 */
export const startQdrantServer = async (): Promise<{ httpPort: number; grpcPort: number }> => {
  // Get free ports for Qdrant HTTP and gRPC servers
  const httpPort = await getPort();
  const grpcPort = await getPort({ port: httpPort + 1 }); // Try to get consecutive ports if possible

  const qdrantServerPath = path.join(process.env.APP_ROOT, 'bin', 'qdrant');
  console.log('qdrantServerPath', qdrantServerPath);

  // Check if Qdrant server binary exists
  if (!fs.existsSync(qdrantServerPath)) {
    console.error(`Qdrant server binary not found at ${qdrantServerPath}`);
    throw new Error('Qdrant server binary not found');
  }

  // Create necessary directories
  const userData = app.getPath('userData');
  const qdrantDataDir = path.join(userData, 'qdrant-data');
  const qdrantStoragePath = path.join(qdrantDataDir, 'storage');
  const qdrantSnapshotsPath = path.join(qdrantDataDir, 'snapshots');
  const qdrantConfigDir = path.join(qdrantDataDir, 'config');

  // Ensure directories exist
  for (const dir of [qdrantDataDir, qdrantStoragePath, qdrantSnapshotsPath, qdrantConfigDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create a Qdrant config file
  const configPath = path.join(qdrantConfigDir, 'config.yaml');

  // Write Qdrant config
  fs.writeFileSync(
    configPath,
    `log_level: INFO

storage:
  # Where to store all the data
  storage_path: ${qdrantStoragePath.replace(/\\/g, '/')}

  # Where to store snapshots
  snapshots_path: ${qdrantSnapshotsPath.replace(/\\/g, '/')}

  # Whether to store payload on disk
  on_disk_payload: true

service:
  # Host to bind the service on
  host: 127.0.0.1

  # HTTP port to bind the service on
  http_port: ${httpPort}

  # gRPC port to bind the service on
  grpc_port: ${grpcPort}

  # Enable CORS headers in REST API
  enable_cors: true

# Disable telemetry
telemetry_disabled: true
`,
  );

  // Start Qdrant server with the config file
  qdrantProcess = spawn(qdrantServerPath, ['--config-path', configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    if (!qdrantProcess) {
      return reject(new Error('Failed to start Qdrant server'));
    }

    let startupError = '';

    // Listen for Qdrant startup messages
    qdrantProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`Qdrant: ${output}`);

      // When Qdrant reports it's ready to accept connections
      if (
        output.includes('Actix runtime found') ||
        output.includes('Starting') ||
        output.includes('Started')
      ) {
        console.log(`Qdrant server running on HTTP port ${httpPort} and gRPC port ${grpcPort}`);
        resolve({ httpPort, grpcPort });
      }
    });

    qdrantProcess.stderr?.on('data', (data) => {
      const errorOutput = data.toString();
      console.error(`Qdrant error: ${errorOutput}`);
      startupError += errorOutput;
    });

    qdrantProcess.on('error', (error) => {
      console.error('Failed to start Qdrant server:', error);
      reject(error);
    });

    qdrantProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Qdrant server exited with code ${code}`);

        // Check for specific error cases
        if (startupError.includes('Address already in use')) {
          // Port conflict - try again with different ports
          console.log('Qdrant port conflict, retrying with different ports...');
          if (qdrantProcess) {
            qdrantProcess = null;
            startQdrantServer().then(resolve).catch(reject);
          }
        } else {
          reject(new Error(`Qdrant server exited with code ${code}: ${startupError}`));
        }
      }
    });

    // Set a timeout in case Qdrant doesn't start properly
    setTimeout(() => {
      if (qdrantProcess?.killed === false) {
        console.log("Qdrant startup timeout reached, assuming it's running");
        resolve({ httpPort, grpcPort }); // Assume it's running even if we didn't see the "ready" message
      }
    }, 8000); // Give Qdrant a bit more time to start up
  });
};

/**
 * Shuts down the Qdrant server
 */
export const shutdownQdrantServer = () => {
  // Clean up Qdrant process
  if (qdrantProcess && !qdrantProcess.killed) {
    console.log('Shutting down Qdrant server...');
    try {
      process.kill(qdrantProcess.pid!, 'SIGTERM');
    } catch (err) {
      console.error('Error shutting down Qdrant server:', err);
    }
    qdrantProcess = null;
  }
};
