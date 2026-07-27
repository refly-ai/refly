/**
 * Sentry is opt-in to avoid production RSS growth from 100% traces/profiles.
 * Enable with SENTRY_ENABLED=true and a non-empty SENTRY_DSN.
 */
export function isSentryEnabled(): boolean {
  return process.env.SENTRY_ENABLED === 'true' && Boolean(process.env.SENTRY_DSN?.trim());
}

export function getSentryTracesSampleRate(): number {
  const raw = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.05');
  if (!Number.isFinite(raw)) return 0.05;
  return Math.min(1, Math.max(0, raw));
}

export function getSentryProfilesSampleRate(): number {
  const raw = Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0');
  if (!Number.isFinite(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}
