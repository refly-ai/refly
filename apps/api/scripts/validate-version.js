#!/usr/bin/env node

/**
 * Validate that the APP_VERSION and COMMIT_HASH environment variables are set
 * This script can be used to test the environment variable injection locally
 */

console.log("=== Refly API Version Validation ===");
console.log("APP_VERSION:", process.env.APP_VERSION || "Not set");
console.log("COMMIT_HASH:", process.env.COMMIT_HASH || "Not set");
console.log("====================================");

if (!process.env.APP_VERSION || !process.env.COMMIT_HASH) {
  console.error(
    "Warning: One or more version environment variables are not set."
  );
  console.log(
    "These should be set in production builds via Docker build args."
  );
  console.log("For local testing, you can run:");
  console.log(
    "APP_VERSION=$(node -p \"require('./package.json').version\") COMMIT_HASH=$(git rev-parse HEAD) node scripts/validate-version.js"
  );
} else {
  console.log("✅ Version environment variables are set correctly!");
}
