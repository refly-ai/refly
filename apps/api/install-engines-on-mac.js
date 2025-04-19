// For packing this Electron app on Mac, we have to have the Prisma binaries for
// both darwin (for Intel Mac) and darwin-arm64 (for M1 Mac). Those binaries will be included in the extraResources.
// The correct binary for the platform this app runs on will be selected at runtime.
// See `qePath` in `src/server/constants.ts`, which gets set with the current platform
// and passed into the Prisma Client constructor.

// Specifying both darwin and darwin-arm64 is also necessary in the schema.prisma file, so that the generated
// client will be able to use either.

if (process.platform === 'darwin') {
  const child_process = require('node:child_process');

  child_process.execSync('rm -rf node_modules/@prisma/engines && npm install @prisma/engines', {
    stdio: [0, 1, 2],
    env: {
      ...process.env,
      PRISMA_CLI_BINARY_TARGETS: 'darwin,darwin-arm64',
    },
  });
}
