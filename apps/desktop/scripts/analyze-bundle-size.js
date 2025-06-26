#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');

/**
 * Formats bytes into human readable format
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Analyzes ASAR archive files
 * @param {string} asarPath - Path to the ASAR file
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeAsarFile(asarPath) {
  try {
    // Import asar dynamically since it might not be available in all environments

    if (!fs.existsSync(asarPath)) {
      return { error: `ASAR file not found: ${asarPath}` };
    }

    const asarStat = fs.statSync(asarPath);
    const asarSize = asarStat.size;

    // Get the header to analyze the internal structure
    const headerInfo = asar.getRawHeader(asarPath);
    const headerString = headerInfo.headerString;

    let header;
    try {
      header = JSON.parse(headerString);
    } catch (parseError) {
      return {
        error: `Failed to parse ASAR header JSON: ${parseError.message}`,
      };
    }

    // Extract file information from the header
    const asarFiles = [];

    function extractFilesFromHeader(files, currentPath = '') {
      for (const [name, entry] of Object.entries(files)) {
        const fullPath = currentPath ? `${currentPath}/${name}` : name;

        if (entry.files) {
          // It's a directory
          extractFilesFromHeader(entry.files, fullPath);
        } else {
          // It's a file
          asarFiles.push({
            path: fullPath,
            size: entry.size || 0,
            offset: entry.offset ? Number.parseInt(entry.offset, 10) : 0,
            executable: entry.executable || false,
          });
        }
      }
    }

    if (header.files) {
      extractFilesFromHeader(header.files);
    } else {
      return { error: 'ASAR header does not contain files structure' };
    }

    // Calculate total size of files inside ASAR
    const totalInternalSize = asarFiles.reduce((sum, file) => sum + file.size, 0);

    return {
      asarSize,
      totalInternalSize,
      fileCount: asarFiles.length,
      files: asarFiles.sort((a, b) => b.size - a.size),
      compressionRatio: totalInternalSize > 0 ? asarSize / totalInternalSize : 0,
    };
  } catch (error) {
    return { error: `Error analyzing ASAR file: ${error.message}` };
  }
}

/**
 * Analyzes the bundle size of the Refly app
 */
async function analyzeBundleSize() {
  const basePath = path.join(
    process.cwd(),
    'packed',
    'mac-arm64',
    'Refly.app',
    'Contents',
    'Resources',
  );

  const asarPath = path.join(basePath, 'app.asar');

  console.log('🔍 Analyzing Refly app bundle size...');
  console.log(`📁 Base path: ${basePath}`);
  console.log('');

  let totalBundleSize = 0;
  const analysisResults = {};

  // Analyze app.asar file
  if (fs.existsSync(asarPath)) {
    console.log('📊 Analyzing ASAR archive...');
    const asarAnalysis = await analyzeAsarFile(asarPath);

    if (asarAnalysis.error) {
      console.log(`❌ ${asarAnalysis.error}`);
    } else {
      totalBundleSize += asarAnalysis.asarSize;
      analysisResults.asar = asarAnalysis;

      console.log(
        `✅ ASAR archive: ${formatBytes(asarAnalysis.asarSize)} (${asarAnalysis.fileCount.toLocaleString()} files)`,
      );
      console.log(`   Internal size: ${formatBytes(asarAnalysis.totalInternalSize)}`);
      console.log(`   Compression ratio: ${(asarAnalysis.compressionRatio * 100).toFixed(1)}%`);
    }
  } else {
    console.log('❌ app.asar file not found');
  }

  if (totalBundleSize === 0) {
    console.error('');
    console.error('❌ No bundle files found!');
    console.error('💡 Make sure you have built the app first:');
    console.error('   npm run build');
    console.error('   npm run pack');
    return;
  }

  // Display comprehensive results
  console.log('');
  console.log('📈 COMPREHENSIVE BUNDLE ANALYSIS');
  console.log('=================================');
  console.log('');
  console.log(`📦 Total bundle size: ${formatBytes(totalBundleSize)}`);

  console.log('');

  // Show top 20 largest files from ASAR
  const allFiles = [];

  if (analysisResults.asar && !analysisResults.asar.error) {
    for (const file of analysisResults.asar.files) {
      allFiles.push({
        ...file,
        source: 'asar',
        displayPath: file.path,
      });
    }
  }

  if (allFiles.length > 0) {
    const sortedFiles = allFiles.sort((a, b) => b.size - a.size);
    const topFiles = sortedFiles.slice(0, 30);

    console.log('🏆 TOP 20 LARGEST FILES:');
    console.log('------------------------');

    for (const [index, file] of topFiles.entries()) {
      const percentage = ((file.size / totalBundleSize) * 100).toFixed(1);
      console.log(
        `${(index + 1).toString().padStart(2)}. ${formatBytes(file.size).padStart(10)} (${percentage.padStart(5)}%) 📦 ${file.displayPath}`,
      );
    }
  }

  console.log('');
  console.log('💡 OPTIMIZATION SUGGESTIONS:');
  console.log('----------------------------');

  // Analyze file types
  const fileTypes = {};
  for (const file of allFiles) {
    const ext = path.extname(file.displayPath).toLowerCase() || 'no-extension';
    if (!fileTypes[ext]) {
      fileTypes[ext] = { count: 0, size: 0 };
    }
    fileTypes[ext].count++;
    fileTypes[ext].size += file.size;
  }

  const sortedTypes = Object.entries(fileTypes)
    .sort(([, a], [, b]) => b.size - a.size)
    .slice(0, 5);

  console.log('📊 Top file types by size:');
  for (const [ext, data] of sortedTypes) {
    const percentage = ((data.size / totalBundleSize) * 100).toFixed(1);
    console.log(
      `   ${ext.padEnd(15)} ${formatBytes(data.size).padStart(10)} (${percentage.padStart(5)}%) - ${data.count} files`,
    );
  }

  if (analysisResults.asar && !analysisResults.asar.error) {
    const largestAsarFile = analysisResults.asar.files[0];
    if (largestAsarFile) {
      const largestAsarPercentage =
        (largestAsarFile.size / analysisResults.asar.totalInternalSize) * 100;
      if (largestAsarPercentage > 20) {
        console.log(
          `⚠️  Largest ASAR file (${largestAsarFile.path}) takes up ${largestAsarPercentage.toFixed(1)}% of ASAR content.`,
        );
        console.log('   Consider code splitting or optimization for this file.');
      }
    }

    console.log(
      `📦 ASAR compression efficiency: ${(analysisResults.asar.compressionRatio * 100).toFixed(1)}%`,
    );
    if (analysisResults.asar.compressionRatio > 0.9) {
      console.log('   ASAR provides minimal compression. Consider pre-compressing large assets.');
    }
  }
}

// Run the analysis
if (require.main === module) {
  analyzeBundleSize().catch(console.error);
}

module.exports = {
  analyzeBundleSize,
  formatBytes,
  analyzeAsarFile,
};
