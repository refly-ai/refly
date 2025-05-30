/**
 * Copy Package Dist Script
 *
 * This script copies dist directories from specific workspace packages to the electron distribution folder.
 * It's designed to make workspace packages easily accessible to the electron asar file.
 *
 * Purpose:
 * - Copies only packages listed in register-aliases.ts to 'apps/api/dist/packages/\*\/dist'
 * - Ensures electron can locate and use workspace packages in the bundled application
 * - Maintains the same directory structure for consistent imports
 *
 * Usage:
 * - Direct: 'node scripts/copy-package-dist.js'
 * - Via npm: 'pnpm copy-package-dist'
 *
 * Features:
 * - Only copies packages defined in register-aliases.ts
 * - Excludes source map and type declaration files to reduce bundle size
 * - Cleans existing target directories before copying
 * - Provides detailed logging of the copy process
 * - Handles errors gracefully for individual packages
 * - Uses only built-in Node.js modules and available dependencies
 *
 * @author Refly Development Team
 */

const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const ncp = promisify(require('ncp'));

// Define the packages to copy based on register-aliases.ts
const PACKAGES_TO_COPY = [
  'openapi-schema',
  'errors',
  'common-types',
  'utils',
  'providers',
  'skill-template',
];

/**
 * Custom copy function that excludes .js.map files
 */
async function copyWithFilter(source, dest) {
  return new Promise((resolve, reject) => {
    ncp(
      source,
      dest,
      {
        filter: (filename) => {
          // Exclude .js.map files
          return (
            !filename.endsWith('.js.map') &&
            !filename.endsWith('.d.ts') &&
            !filename.endsWith('.d.ts.map')
          );
        },
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
}

/**
 * Copy specific dist directories from packages to apps/api/dist-electron/packages
 * This makes it easier for electron asar file to locate workspace packages
 */
async function copyPackageDist() {
  const rootDir = path.resolve(__dirname, '..');
  const packagesDir = path.join(rootDir, 'packages');
  const targetDir = path.join(rootDir, 'apps', 'api', 'dist', 'packages');

  console.log('🚀 Starting package dist copy process...');
  console.log(`📁 Source: ${packagesDir}`);
  console.log(`📁 Target: ${targetDir}`);
  console.log(`📋 Packages to copy: ${PACKAGES_TO_COPY.join(', ')}`);

  try {
    // Ensure target directory exists
    await fs.promises.mkdir(targetDir, { recursive: true });
    console.log('✅ Target directory ensured');

    // Find packages with dist directories from our allowed list
    const packagesWithDist = [];
    for (const packageName of PACKAGES_TO_COPY) {
      const distPath = path.join(packagesDir, packageName, 'dist');
      try {
        const stats = await fs.promises.stat(distPath);
        if (stats.isDirectory()) {
          packagesWithDist.push(packageName);
        } else {
          console.log(`⚠️  ${packageName}/dist exists but is not a directory`);
        }
      } catch (_error) {
        console.log(`⚠️  ${packageName}/dist directory not found, skipping`);
      }
    }

    if (packagesWithDist.length === 0) {
      console.log('⚠️  No dist directories found in specified packages');
      return;
    }

    console.log(`📋 Found ${packagesWithDist.length} package(s) with dist directories:`);
    for (const pkg of packagesWithDist) {
      console.log(`   - ${pkg}`);
    }

    // Copy each dist directory
    for (const packageName of packagesWithDist) {
      const sourcePath = path.join(packagesDir, packageName, 'dist');
      const targetPackageDir = path.join(targetDir, packageName);
      const targetPath = path.join(targetPackageDir, 'dist');

      console.log(`\n📋 Copying ${packageName}/dist...`);

      try {
        // Remove existing target directory if it exists
        try {
          await fs.promises.rm(targetPath, { recursive: true, force: true });
          console.log(`   🗑️  Removed existing ${packageName}/dist`);
        } catch (_error) {
          // Directory doesn't exist, that's fine
        }

        // Ensure parent directory exists
        await fs.promises.mkdir(targetPackageDir, { recursive: true });

        // Copy the dist directory using custom filter to exclude .js.map files
        await copyWithFilter(sourcePath, targetPath);

        console.log(`   ✅ Successfully copied ${packageName}/dist (excluding .js.map files)`);
      } catch (error) {
        console.error(`   ❌ Failed to copy ${packageName}/dist:`, error.message);
      }
    }

    console.log('\n🎉 Package dist copy process completed!');
    console.log(`📊 Total packages processed: ${packagesWithDist.length}`);
    console.log('📝 Note: .js.map files were excluded from the copy process');
  } catch (error) {
    console.error('❌ Error during copy process:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  copyPackageDist().catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { copyPackageDist };
