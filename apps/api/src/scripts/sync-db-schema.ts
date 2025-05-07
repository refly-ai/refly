import { execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Finds the path to node_modules by traversing up from the current directory
 * @param startDir Directory to start searching from
 * @param maxDepth Maximum number of parent directories to check
 * @returns Path to the node_modules directory or null if not found
 */
const findNodeModules = (startDir: string, maxDepth = 10): string | null => {
  let currentDir = startDir;
  let depth = 0;

  while (depth < maxDepth) {
    const nodeModulesPath = join(currentDir, 'node_modules');

    if (existsSync(nodeModulesPath)) {
      console.log(`Found node_modules directory: ${nodeModulesPath}`);
      return nodeModulesPath;
    }

    console.log(`Cannot find node_modules directory in ${nodeModulesPath}, search for the parent`);
    const parentDir = dirname(currentDir);

    // If we've reached the root directory
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth += 1;
  }

  return null;
};

// Start looking for node_modules from the directory of this script
const nodeModulesPath =
  findNodeModules(__dirname) ||
  findNodeModules(resolve(process.cwd())) ||
  join(process.cwd(), 'node_modules');

// Check if the prisma binary exists
const prismaBin = join(nodeModulesPath, '.bin', 'prisma');

// Fallback to using pnpm bin if the above approach fails
if (!existsSync(prismaBin)) {
  console.warn('Could not find Prisma binary using directory traversal, falling back to pnpm bin');
  const binPath = execSync('pnpm bin', { encoding: 'utf-8' }).trim();
  const fallbackPrismaBin = join(binPath, 'prisma');

  execSync(
    `${fallbackPrismaBin} migrate diff --from-url ${process.env.DATABASE_URL} --to-schema-datamodel prisma/schema.prisma --script | ${fallbackPrismaBin} db execute --stdin`,
    { stdio: 'inherit' },
  );
} else {
  execSync(
    `${prismaBin} migrate diff --from-url ${process.env.DATABASE_URL} --to-schema-datamodel prisma/schema.prisma --script | ${prismaBin} db execute --stdin`,
    { stdio: 'inherit' },
  );
}
