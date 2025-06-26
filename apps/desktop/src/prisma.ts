import path from 'node:path';
import { app } from 'electron';
import { existsSync } from 'node:fs';
import { fork } from 'node:child_process';
import log from 'electron-log';

const platformToExecutables = {
  win32: {
    schemaEngine: 'node_modules/@prisma/engines/schema-engine-windows.exe',
    queryEngine: 'node_modules/@prisma/engines/query_engine-windows.dll.node',
  },
  linux: {
    schemaEngine: 'node_modules/@prisma/engines/schema-engine-debian-openssl-1.1.x',
    queryEngine: 'node_modules/@prisma/engines/libquery_engine-debian-openssl-1.1.x.so.node',
  },
  darwin: {
    schemaEngine: 'node_modules/@prisma/engines/schema-engine-darwin-arm64',
    queryEngine: 'node_modules/@prisma/engines/libquery_engine-darwin-arm64.dylib.node',
  },
};

function getPrismaBinaryPath() {
  const asarUnpackedRoot = app.getAppPath().replace('app.asar', 'app.asar.unpacked');

  const qePath = path.join(asarUnpackedRoot, platformToExecutables[process.platform].queryEngine);
  log.info('Query engine path', qePath);

  if (!existsSync(qePath)) {
    throw new Error(`Query engine path does not exist: ${qePath}`);
  }

  const sePath = path.join(asarUnpackedRoot, platformToExecutables[process.platform].schemaEngine);
  log.info('Schema engine path', sePath);

  if (!existsSync(sePath)) {
    throw new Error(`Schema engine path does not exist: ${sePath}`);
  }

  return {
    qePath,
    sePath,
  };
}

export function preparePrismaEnv() {
  const { qePath, sePath } = getPrismaBinaryPath();

  process.env.PRISMA_SCHEMA_ENGINE_BINARY = sePath;
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = qePath;
}

export async function runPrismaCommand({ command, dbUrl }) {
  try {
    const exitCode = await new Promise((resolve, reject) => {
      const prismaPath = path.resolve(app.getAppPath(), 'node_modules/prisma/build/index.js');
      log.info('Prisma path', prismaPath);

      const child = fork(prismaPath, command, {
        env: {
          ...process.env,
          DATABASE_URL: dbUrl,
        },
        stdio: 'pipe',
      });

      // Capture and log stdout
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            log.info(`[Prisma stdout]: ${output}`);
          }
        });
      }

      // Capture and log stderr
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            log.error(`[Prisma stderr]: ${output}`);
          }
        });
      }

      child.on('error', (err) => {
        log.error('Child process got error:', err);
        reject(err);
      });

      child.on('close', (code, signal) => {
        if (signal) {
          log.warn(`Child process terminated by signal: ${signal}`);
        }
        log.info(`Child process exited with code: ${code}`);
        resolve(code);
      });

      child.on('exit', (code, signal) => {
        log.info(`Child process exit event - code: ${code}, signal: ${signal}`);
      });
    });

    if (exitCode !== 0) {
      const errorMsg = `Prisma command '${command.join(' ')}' failed with exit code ${exitCode}`;
      throw new Error(errorMsg);
    }

    return exitCode;
  } catch (e) {
    log.error(e);
    throw e;
  }
}
