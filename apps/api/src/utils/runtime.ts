import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Whether the current process is running in desktop mode
 */
export const isDesktop = (): boolean => process.env.MODE === 'desktop';

/**
 * Finds the path to node_modules by traversing up from the current directory
 * @param startDir Directory to start searching from
 * @param maxDepth Maximum number of parent directories to check
 * @returns Path to the node_modules directory or null if not found
 */
export const findNodeModules = (startDir: string, maxDepth = 10): string | null => {
  let currentDir = startDir;
  let depth = 0;

  while (depth < maxDepth) {
    const nodeModulesPath = path.join(currentDir, 'node_modules');

    if (existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }

    const parentDir = path.dirname(currentDir);

    // If we've reached the root directory
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth += 1;
  }

  return null;
};
