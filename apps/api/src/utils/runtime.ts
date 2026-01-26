import path from 'node:path';
import { existsSync, statSync } from 'node:fs';

/**
 * Whether the current process is running in desktop mode
 */
export const isDesktop = (): boolean => process.env.MODE === 'desktop';

/**
 * Type for the target to search for
 */
type TargetType = 'file' | 'directory';

/**
 * Finds the path to the target file or directory by traversing up from the current directory
 * @param startDir Directory to start searching from
 * @param targetName Name of the target file or directory to find
 * @param targetType Type of target to search for ('file' or 'directory')
 * @param maxDepth Maximum number of parent directories to check
 * @returns Path to the target or null if not found
 */
const findTargetPath = (
  startDir: string,
  targetName: string,
  targetType: TargetType = 'file',
  maxDepth = 10,
): string | null => {
  let currentDir = startDir;
  let depth = 0;

  while (depth < maxDepth) {
    const targetPath = path.join(currentDir, targetName);

    if (existsSync(targetPath)) {
      try {
        const stats = statSync(targetPath);
        const isDirectory = stats.isDirectory();

        if (
          (targetType === 'directory' && isDirectory) ||
          (targetType === 'file' && !isDirectory)
        ) {
          return targetPath;
        }
      } catch (error) {
        // If statSync fails, continue to next directory
        console.warn(`Failed to stat ${targetPath}:`, error);
      }
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

/**
 * Finds the path to the target file by traversing up from the current directory
 * @param startDir Directory to start searching from
 * @param filename Name of the target file to find
 * @param maxDepth Maximum number of parent directories to check
 * @returns Path to the target file or null if not found
 */
export const findTargetFile = (
  startDir: string,
  filename: string,
  maxDepth = 10,
): string | null => {
  return findTargetPath(startDir, filename, 'file', maxDepth);
};

/**
 * Finds the path to the target directory by traversing up from the current directory
 * @param startDir Directory to start searching from
 * @param dirname Name of the target directory to find
 * @param maxDepth Maximum number of parent directories to check
 * @returns Path to the target directory or null if not found
 */
export const findTargetDirectory = (
  startDir: string,
  dirname: string,
  maxDepth = 10,
): string | null => {
  return findTargetPath(startDir, dirname, 'directory', maxDepth);
};
