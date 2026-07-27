/**
 * One-shot ops script: trim historical BullMQ job hashes that predate
 * removeOnComplete/removeOnFail defaults (the Dec-2025 Redis OOM class).
 *
 * Usage (from apps/api, with REDIS_* or REDIS_URL in env):
 *   DRY_RUN=1 npx ts-node -r tsconfig-paths/register src/scripts/cleanup-stale-bull-jobs.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/cleanup-stale-bull-jobs.ts
 *
 * Safety:
 * - Only deletes job hashes that are members of `:completed` or `:failed` zsets
 *   (or orphan numeric job hashes older than MAX_AGE_MS with finishedOn set).
 * - Never touches :wait / :active / :delayed / :paused / locks / meta.
 * - DRY_RUN=1 (default) only prints counts.
 */
import Redis from 'ioredis';

const DRY_RUN = process.env.DRY_RUN !== '0';
const MAX_AGE_MS = Number(process.env.MAX_AGE_MS ?? 7 * 24 * 3600 * 1000);
const BATCH = Number(process.env.BATCH ?? 200);
const QUEUES = (
  process.env.QUEUES ??
  'skill,syncTokenUsage,syncRequestUsage,sandbox-execute-request,runWorkflow,autoNameCanvas,imageProcessing,scheduleExecution,scaleboxExecute,createShare,skillExecution,skillWorkflow'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function createClient(): Redis {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      tls: process.env.REDIS_TLS === '1' ? {} : undefined,
    });
  }
  return new Redis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === '1' || process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null,
  });
}

async function drainZsetJobs(
  redis: Redis,
  queue: string,
  state: 'completed' | 'failed',
  cutoff: number,
): Promise<{ scanned: number; deleted: number }> {
  const zkey = `bull:${queue}:${state}`;
  const type = await redis.type(zkey);
  if (type !== 'zset') {
    return { scanned: 0, deleted: 0 };
  }

  let scanned = 0;
  let deleted = 0;
  let start = 0;

  // Scores in BullMQ completed/failed zsets are finishedOn timestamps (ms).
  while (true) {
    const batch = await redis.zrangebyscore(zkey, '-inf', cutoff, 'LIMIT', start, BATCH);
    if (batch.length === 0) break;

    scanned += batch.length;
    const jobKeys = batch.map((id) => `bull:${queue}:${id}`);

    if (DRY_RUN) {
      deleted += jobKeys.length;
      // Advance by batch size; dry-run does not mutate so use offset.
      start += batch.length;
      if (batch.length < BATCH) break;
      continue;
    }

    const pipeline = redis.pipeline();
    for (const id of batch) {
      pipeline.del(`bull:${queue}:${id}`);
      pipeline.zrem(zkey, id);
    }
    await pipeline.exec();
    deleted += batch.length;
    // After delete, next oldest is still at the front — do not advance start.
    if (batch.length < BATCH) break;
  }

  return { scanned, deleted };
}

async function trimEventsStream(redis: Redis, queue: string, maxLen: number): Promise<number> {
  const key = `bull:${queue}:events`;
  const type = await redis.type(key);
  if (type !== 'stream') return 0;
  if (DRY_RUN) {
    const len = await redis.xlen(key);
    return Math.max(0, len - maxLen);
  }
  // Approximate trim to maxLen entries
  await redis.xtrim(key, 'MAXLEN', '~', maxLen);
  return maxLen;
}

async function main() {
  const redis = createClient();
  const cutoff = Date.now() - MAX_AGE_MS;
  console.log(
    JSON.stringify({
      dryRun: DRY_RUN,
      cutoffIso: new Date(cutoff).toISOString(),
      maxAgeMs: MAX_AGE_MS,
      queues: QUEUES,
    }),
  );

  try {
    await redis.ping();
    for (const queue of QUEUES) {
      const completed = await drainZsetJobs(redis, queue, 'completed', cutoff);
      const failed = await drainZsetJobs(redis, queue, 'failed', cutoff);
      const eventsTrimmed = await trimEventsStream(redis, queue, 1000);
      console.log(
        JSON.stringify({
          queue,
          completed,
          failed,
          eventsTrimmedApprox: eventsTrimmed,
        }),
      );
    }
  } finally {
    await redis.quit();
  }

  if (DRY_RUN) {
    console.log('Dry-run only. Re-run with DRY_RUN=0 to apply deletes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
