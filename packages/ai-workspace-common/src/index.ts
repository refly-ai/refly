/**
 * Package public entry point.
 *
 * This file is intentionally kept lightweight:
 * - It satisfies package.json "main"/"types" references for tooling (tsc/knip).
 * - It re-exports the most common public modules from stable entry files.
 *
 * Note: Some modules (e.g. deep component paths like `components/slideshow/...`)
 * are consumed via path aliases in other workspaces and are not (yet) re-exported here.
 */

export * from './components';
export * from './queries';
export * from './utils';
