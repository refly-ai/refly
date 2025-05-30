import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { findNodeModules } from '../utils/runtime';

// Start looking for node_modules from the directory of this script
const nodeModulesPath =
  findNodeModules(__dirname) ||
  findNodeModules(resolve(process.cwd())) ||
  join(process.cwd(), 'node_modules');

if (require.main === module) {
  // Check if the prisma binary exists
  let prismaBin = join(nodeModulesPath, '.bin', 'prisma');

  // Fallback to using pnpm bin if the above approach fails
  if (!existsSync(prismaBin)) {
    console.warn(
      'Could not find Prisma binary using directory traversal, falling back to pnpm bin',
    );
    const binPath = execSync('pnpm bin', { encoding: 'utf-8' }).trim();
    prismaBin = join(binPath, 'prisma');
  }

  execSync(
    `${prismaBin} migrate diff --from-url ${process.env.DATABASE_URL} --to-schema-datamodel prisma/schema.prisma --script | ${prismaBin} db execute --stdin`,
    { stdio: 'inherit' },
  );
}
