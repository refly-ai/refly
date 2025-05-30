#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

/**
 * Recursively find all node_modules directories
 * @param {string} dir - Directory to search in
 * @param {string[]} nodeModulesPaths - Array to collect found paths
 */
function findNodeModules(dir, nodeModulesPaths = []) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const fullPath = path.join(dir, item.name);

        if (item.name === 'node_modules') {
          nodeModulesPaths.push(fullPath);
          console.log(`Found: ${fullPath}`);
        } else {
          // Skip common directories that shouldn't contain node_modules we want to delete
          const skipDirs = ['.git', '.turbo', 'dist', 'build', 'coverage', '.next', '.nuxt'];
          if (!skipDirs.includes(item.name)) {
            findNodeModules(fullPath, nodeModulesPaths);
          }
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read (permission issues, etc.)
    console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
  }

  return nodeModulesPaths;
}

/**
 * Delete a directory recursively
 * @param {string} dirPath - Path to directory to delete
 */
function deleteDirectory(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`✅ Deleted: ${dirPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete ${dirPath}: ${error.message}`);
    return false;
  }
}

/**
 * Get human-readable file size
 * @param {number} bytes - Size in bytes
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculate directory size
 * @param {string} dirPath - Path to directory
 */
function getDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        totalSize += getDirectorySize(fullPath);
      } else {
        try {
          const stats = fs.statSync(fullPath);
          totalSize += stats.size;
        } catch (_error) {
          // Skip files we can't stat
        }
      }
    }
  } catch (_error) {
    // Skip directories we can't read
  }

  return totalSize;
}

async function main() {
  console.log('🔍 Searching for node_modules directories...\n');

  const startTime = Date.now();
  const rootDir = process.cwd();

  // Find all node_modules directories
  const nodeModulesPaths = findNodeModules(rootDir);

  if (nodeModulesPaths.length === 0) {
    console.log('✨ No node_modules directories found!');
    return;
  }

  console.log(`\n📊 Found ${nodeModulesPaths.length} node_modules directories`);

  // Calculate total size before deletion
  let totalSize = 0;
  console.log('\n📏 Calculating sizes...');
  for (const dirPath of nodeModulesPaths) {
    const size = getDirectorySize(dirPath);
    totalSize += size;
    console.log(`  ${path.relative(rootDir, dirPath)}: ${formatBytes(size)}`);
  }

  console.log(`\n💾 Total size to be freed: ${formatBytes(totalSize)}`);
  console.log('\n🗑️  Starting deletion...\n');

  // Delete all found node_modules directories
  let deletedCount = 0;
  let failedCount = 0;

  for (const dirPath of nodeModulesPaths) {
    if (deleteDirectory(dirPath)) {
      deletedCount++;
    } else {
      failedCount++;
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log(`\n${'='.repeat(50)}`);
  console.log('📈 Summary:');
  console.log(`  ✅ Successfully deleted: ${deletedCount} directories`);
  console.log(`  ❌ Failed to delete: ${failedCount} directories`);
  console.log(`  💾 Space freed: ${formatBytes(totalSize)}`);
  console.log(`  ⏱️  Time taken: ${duration} seconds`);
  console.log('='.repeat(50));

  if (failedCount > 0) {
    console.log('\n⚠️  Some directories could not be deleted. This might be due to:');
    console.log('   - Permission issues');
    console.log('   - Files being in use');
    console.log('   - System restrictions');
    process.exit(1);
  } else {
    console.log('\n🎉 All node_modules directories have been successfully deleted!');
  }
}

// Handle process interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Process interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Process terminated');
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error('💥 An unexpected error occurred:', error);
  process.exit(1);
});
