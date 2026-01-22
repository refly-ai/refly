#!/usr/bin/env node

const { spawn, execSync } = require('node:child_process');
const _path = require('node:path');
const fs = require('node:fs');

// Set memory limit for Node.js processes
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');
const isFast = args.includes('--fast');

console.log('Building API with increased memory limit...');

/**
 * Copy non-TypeScript assets (like .md templates) from packages to their dist folders.
 * TypeScript compiler doesn't copy these files automatically.
 */
function copyPackageAssets() {
  const skillTemplateDir = _path.resolve(__dirname, '../../../packages/skill-template');
  const srcTemplates = _path.join(skillTemplateDir, 'src/prompts/templates');
  const distTemplates = _path.join(skillTemplateDir, 'dist/prompts/templates');

  if (fs.existsSync(srcTemplates)) {
    console.log('Copying skill-template assets...');
    // Create destination directory if it doesn't exist
    fs.mkdirSync(distTemplates, { recursive: true });
    // Copy templates recursively
    execSync(`cp -r "${srcTemplates}/"* "${distTemplates}/"`, { stdio: 'inherit' });
    console.log('Assets copied successfully');
  }
}

if (isFast) {
  // Use SWC for faster builds
  const swcProcess = spawn(
    'npx',
    ['swc', 'src', '-d', 'dist', '--config-file', '.swcrc', '--strip-leading-paths'],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
    },
  );

  swcProcess.on('close', (code) => {
    if (code === 0) {
      copyPackageAssets();
      console.log('Build completed successfully');
    } else {
      process.exit(code);
    }
  });
} else {
  // Use TypeScript compiler
  const tscArgs = ['tsc', '--build'];
  if (isVerbose) {
    tscArgs.push('--verbose');
  }

  const tscProcess = spawn('npx', tscArgs, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  tscProcess.on('close', (code) => {
    if (code === 0) {
      copyPackageAssets();
      console.log('Build completed successfully');
    } else {
      process.exit(code);
    }
  });
}
