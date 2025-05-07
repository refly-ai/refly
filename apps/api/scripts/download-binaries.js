const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { execSync } = require('node:child_process');

const BIN_DIR = path.join(__dirname, '..', 'dist-electron', 'bin');

// Binary URLs for different platforms
const BINARY_URLS = {
  win32: 'https://static.refly.ai/windows-amd64-redis-qdrant-bin.zip',
  linux: 'https://static.refly.ai/linux-amd64-redis-qdrant-bin.zip',
  darwin: 'https://static.refly.ai/darwin-arm64-redis-qdrant-bin.zip',
};

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

function createProgressBar(total) {
  const width = 30;
  let lastPercent = 0;
  let lastTime = Date.now();
  let lastLoaded = 0;

  return {
    update: (loaded) => {
      const percent = Math.floor((loaded / total) * 100);
      const currentTime = Date.now();
      const timeDiff = (currentTime - lastTime) / 1000;

      // calculate speed
      let speed = '';
      if (timeDiff >= 1) {
        const speedBytes = (loaded - lastLoaded) / timeDiff;
        speed = ` ${formatBytes(speedBytes)}/s`;
        lastLoaded = loaded;
        lastTime = currentTime;
      }

      // only update the progress bar if the percentage has changed
      if (percent !== lastPercent) {
        const filled = Math.floor((percent / 100) * width);
        const empty = width - filled;
        const bar = '='.repeat(filled) + ' '.repeat(empty);
        process.stdout.write(`\rDownloading [${bar}] ${percent}%${speed}`);
        lastPercent = percent;
      }
    },
    complete: () => {
      process.stdout.write('\n');
    },
  };
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const totalSize = Number.parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      const progressBar = createProgressBar(totalSize);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        progressBar.update(downloadedSize);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        progressBar.complete();
        console.log('Download completed!');
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });

    request.setTimeout(30000, () => {
      request.destroy();
      fs.unlink(dest, () => reject(new Error('Download timeout')));
    });
  });
}

async function extractArchive(filePath, destination) {
  console.log(`\nExtracting ${filePath} to ${destination}`);

  // create a temporary directory for extraction
  const tempExtractDir = path.join(destination, 'temp_extract');
  await ensureDirectoryExists(tempExtractDir);

  // use a safe way to handle file paths
  const safeFilePath = filePath.replace(/"/g, '\\"');
  const safeExtractDir = tempExtractDir.replace(/"/g, '\\"');

  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell -command "Expand-Archive -Path '${safeFilePath}' -DestinationPath '${safeExtractDir}' -Force"`,
      );
    } else {
      execSync(`unzip -o "${safeFilePath}" -d "${safeExtractDir}"`);
    }
  } catch (error) {
    console.error(`Error extracting archive: ${error.message}`);
    throw error;
  }

  // move files from temp directory to destination
  try {
    const files = fs.readdirSync(tempExtractDir);
    for (const file of files) {
      const sourcePath = path.join(tempExtractDir, file);
      const targetPath = path.join(destination, file);

      if (fs.statSync(sourcePath).isDirectory()) {
        // if it's a directory, move its contents
        const subFiles = fs.readdirSync(sourcePath);
        for (const subFile of subFiles) {
          const subSourcePath = path.join(sourcePath, subFile);
          const subTargetPath = path.join(destination, subFile);
          try {
            fs.renameSync(subSourcePath, subTargetPath);
            // Only set executable permissions for specific file types
            if (process.platform !== 'win32') {
              if (subFile === 'redis-server' || subFile === 'qdrant') {
                fs.chmodSync(subTargetPath, 0o755); // Executable files
              } else {
                fs.chmodSync(subTargetPath, 0o644); // Non-executable files
              }
            }
          } catch (error) {
            console.error(`Error moving file ${subFile}: ${error.message}`);
          }
        }
        // delete the empty directory
        try {
          fs.rmdirSync(sourcePath);
        } catch (error) {
          console.error(`Error removing directory ${sourcePath}: ${error.message}`);
        }
      } else {
        // if it's a file, move it directly
        try {
          fs.renameSync(sourcePath, targetPath);
          // Set executable permissions on Linux/Mac
          if (process.platform !== 'win32') {
            const isExecutable = /redis-server|qdrant/.test(file);
            fs.chmodSync(targetPath, isExecutable ? 0o755 : 0o644);
          }
        } catch (error) {
          console.error(`Error moving file ${file}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing files: ${error.message}`);
  } finally {
    // Always clean up the temporary directories and files
    try {
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error during cleanup: ${error.message}`);
    }
  }
}

async function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dir}: ${error.message}`);
      throw error;
    }
  }
}

// function verifyFileChecksum(filePath, expectedChecksum) {
//   // 验证文件完整性
// }

async function main() {
  const platform = process.platform;
  const url = BINARY_URLS[platform];

  if (!url) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  console.log(`Platform: ${platform}`);

  try {
    await ensureDirectoryExists(BIN_DIR);

    const tempDir = path.join(BIN_DIR, 'temp');
    await ensureDirectoryExists(tempDir);

    const fileName = url.split('/').pop();
    const filePath = path.join(tempDir, fileName);

    await downloadFile(url, filePath);
    await extractArchive(filePath, BIN_DIR);

    // clean up the temporary directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Error cleaning up temp directory: ${error.message}`);
    }

    console.log('\nBinaries downloaded and extracted successfully!');
  } catch (error) {
    console.error('\nFailed to download binaries:', error);
    process.exit(1);
  }
}

main();
