/**
 * Node.js preload script to resolve workspace dependencies to compiled distribution files
 * This script intercepts module resolution and redirects @refly/foo from
 * packages/foo/src/index.ts to packages/foo/dist/index.js
 */

import Module from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { findTargetFile } from '../utils/runtime';

// Store the original require function
const originalRequire = Module.prototype.require;

// Dynamically generate PACKAGE_MAPPING from package.json @refly/* workspace dependencies
const apiPackageJsonPath = findTargetFile(__dirname, 'package.json');
const apiPackageJson: PackageJson = JSON.parse(fs.readFileSync(apiPackageJsonPath, 'utf-8'));

if (!apiPackageJsonPath) {
  throw new Error('package.json for @refly/api not found');
}

// Get the workspace root directory
const workspaceRoot = path.resolve(apiPackageJsonPath, '../../..');

// Type definitions
interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageMapping {
  source: string;
  target: string;
  resolvedPath: string | null;
}

interface PackageMappings {
  [packageName: string]: PackageMapping;
}

/**
 * Find all @refly/* workspace dependencies in package.json
 * @param pkg - package.json object
 * @returns mapping of package name to {source, target, resolvedPath}
 */
function getWorkspaceMappings(pkg: PackageJson): PackageMappings {
  const mapping: PackageMappings = {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const dep of Object.keys(deps ?? {})) {
    if (dep.startsWith('@refly/')) {
      // e.g. @refly/utils -> utils
      const short = dep.replace('@refly/', '');
      const source = `packages/${short}/src/index.ts`;
      const target = `packages/${short}/dist/index.js`;

      const targetPath = path.resolve(workspaceRoot, target);
      const sourcePath = path.resolve(workspaceRoot, source);

      // Pre-validate file existence during mapping generation
      let resolvedPath: string | null = null;
      if (fileExists(targetPath)) {
        resolvedPath = targetPath;
      } else if (fileExists(sourcePath)) {
        console.warn(
          `[preload] Warning: Target file ${targetPath} not found, falling back to source ${sourcePath}`,
        );
        resolvedPath = sourcePath;
      }

      mapping[dep] = {
        source,
        target,
        resolvedPath,
      };
    }
  }
  return mapping;
}

const PACKAGE_MAPPING = getWorkspaceMappings(apiPackageJson);

/**
 * Check if a file exists
 * @param filePath - Path to check
 * @returns True if file exists
 */
function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Resolve the actual file path for a module
 * @param modulePath - Module path to resolve
 * @returns Resolved path or null if not found
 */
function resolveModulePath(modulePath: string): string | null {
  // Check if this is a package we want to redirect (exact match)
  const packageMapping = PACKAGE_MAPPING[modulePath];
  if (packageMapping) {
    return packageMapping.resolvedPath;
  }

  // Handle subpath imports like @refly/utils/token -> packages/utils/dist/token.js
  if (modulePath.startsWith('@refly/')) {
    const parts = modulePath.replace('@refly/', '').split('/');
    const packageName = parts[0]; // e.g. 'utils'
    const subPath = parts.slice(1).join('/'); // e.g. 'token'

    if (subPath && PACKAGE_MAPPING[`@refly/${packageName}`]) {
      // Try direct file first: @refly/utils/token -> packages/utils/dist/token.js
      const targetPath = path.resolve(workspaceRoot, `packages/${packageName}/dist/${subPath}.js`);
      const sourcePath = path.resolve(workspaceRoot, `packages/${packageName}/src/${subPath}.ts`);

      if (fileExists(targetPath)) {
        return targetPath;
      }

      // Try directory index: @refly/utils/editor -> packages/utils/dist/editor/index.js
      const targetIndexPath = path.resolve(
        workspaceRoot,
        `packages/${packageName}/dist/${subPath}/index.js`,
      );
      const sourceIndexPath = path.resolve(
        workspaceRoot,
        `packages/${packageName}/src/${subPath}/index.ts`,
      );

      if (fileExists(targetIndexPath)) {
        return targetIndexPath;
      } else if (fileExists(sourceIndexPath)) {
        console.warn(
          `[preload] Warning: Subpath target ${targetIndexPath} not found, falling back to source ${sourceIndexPath}`,
        );
        return sourceIndexPath;
      } else if (fileExists(sourcePath)) {
        console.warn(
          `[preload] Warning: Subpath target ${targetPath} not found, falling back to source ${sourcePath}`,
        );
        return sourcePath;
      }
    }
  }

  return null;
}

/**
 * Override the require function to intercept module resolution
 */
Module.prototype.require = function (id: string): any {
  // Try to resolve the module path
  const resolvedPath = resolveModulePath(id);

  if (resolvedPath) {
    return originalRequire.call(this, resolvedPath);
  }

  // For other modules, use the original require
  return originalRequire.call(this, id);
};

// Log that the preload script is active
console.log(
  `[preload] override module resolution path for packages: ${Object.keys(PACKAGE_MAPPING).join(', ')}`,
);
