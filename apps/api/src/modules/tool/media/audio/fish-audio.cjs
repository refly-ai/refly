/**
 * CJS wrapper for fish-audio SDK
 * Resolves ESM/CJS compatibility issues in TypeScript
 *
 * The fish-audio package is an ESM module ("type": "module" in package.json),
 * but we need to use it in a CommonJS environment (NestJS with tsconfig "module": "commonjs").
 * This wrapper uses dynamic import() to load the ESM module at runtime.
 */

let fishAudioModule = null;

async function loadFishAudio() {
  if (!fishAudioModule) {
    fishAudioModule = await import('fish-audio');
  }
  return fishAudioModule;
}

// Export a promise-based loader
module.exports = {
  loadFishAudio,
  // For convenience, also export the loader as default
  default: loadFishAudio,
};
