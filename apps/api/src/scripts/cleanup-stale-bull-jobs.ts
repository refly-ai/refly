/**
 * One-shot ops script: trim historical BullMQ job hashes that predate
 * removeOnComplete/removeOnFail defaults (the Dec-2025 Redis OOM class).
 *
 * Usage (from apps/api, with REDIS_* or REDIS_URL in env):
 *   DRY_RUN=1 npx ts-node -r tsconfig-paths/register src/scripts/cleanup-stale-bull-jobs.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/cleanup-stale-bull-jobs.ts
 *
 * Safety:
 * - Uses BullMQ Queue.clean (atomic Lua) for completed/failed jobs only.
 * - Never touches :wait / :active / :delayed / :paused / locks / meta.
 * - DRY_RUN=1 (default) only prints counts.
 */
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const DRY_RUN = process.env.DRY_RUN !== '0';

function parsePositiveInt(name: string, raw: string | undefined, defaultValue: number): number {
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive finite integer, got: ${JSON.stringify(raw)}`);
  }
  return n;
}

const MAX_AGE_MS = parsePositiveInt('MAX_AGE_MS', process.env.MAX_AGE_MS, 7 * 24 * 3600 * 1000);
const BATCH = parsePositiveInt('BATCH', process.env.BATCH, 200);
const QUEUES = (
  process.env.QUEUES ??
  'skill,syncTokenUsage,syncRequestUsage,sandbox-execute-request,runWorkflow,autoNameCanvas,imageProcessing,scheduleExecution,scaleboxExecute,createShare,skillExecution,skillWorkflow'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isRedisTlsEnabled(): boolean {
  const v = process.env.REDIS_TLS;
  return v === '1' || v === 'true';
}

function createRedis(): Redis {
  const tls = isRedisTlsEnabled() ? {} : undefined;
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      tls,
    });
  }
  return new Redis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls,
    maxRetriesPerRequest: null,
  });
}

/**
 * Remove completed/failed jobs older than MAX_AGE_MS via BullMQ's atomic clean.
 */
async function drainState(
  queue: Queue,
  state: 'completed' | 'failed',
): Promise<{ scanned: number; deleted: number }> {
  let scanned = 0;
  let deleted = 0;

  if (DRY_RUN) {
    // Approximate: count finished jobs older than cutoff without mutating.
    // getJobs may yield undefined for orphaned zset entries — skip those.
    const cutoff = Date.now() - MAX_AGE_MS;
    let start = 0;
    while (true) {
      const jobs = await queue.getJobs([state], start, start + BATCH - 1, true);
      if (jobs.length === 0) break;
      const stale = jobs.filter(
        (j) => j != null && (j.finishedOn ?? 0) > 0 && (j.finishedOn ?? 0) <= cutoff,
      );
      scanned += stale.length;
      deleted += stale.length;
      if (jobs.length < BATCH) break;
      start += jobs.length;
    }
    return { scanned, deleted };
  }

  while (true) {
    // grace = MAX_AGE_MS: clean jobs finished more than MAX_AGE_MS ago.
    const removed = await queue.clean(MAX_AGE_MS, BATCH, state);
    scanned += removed.length;
    deleted += removed.length;
    if (removed.length < BATCH) break;
  }

  return { scanned, deleted };
}

async function trimEventsStream(redis: Redis, queueName: string, maxLen: number): Promise<number> {
  const key = `bull:${queueName}:events`;
  const type = await redis.type(key);
  if (type !== 'stream') return 0;
  if (DRY_RUN) {
    const len = await redis.xlen(key);
    return Math.max(0, len - maxLen);
  }
  // XTRIM returns the number of entries actually removed.
  return await redis.xtrim(key, 'MAXLEN', '~', maxLen);
}

async function main(): Promise<void> {
  const redis = createRedis();

  console.log(
    JSON.stringify({
      dryRun: DRY_RUN,
      cutoffIso: new Date(Date.now() - MAX_AGE_MS).toISOString(),
      maxAgeMs: MAX_AGE_MS,
      batch: BATCH,
      queues: QUEUES,
    }),
  );

  const queues: Queue[] = [];
  try {
    await redis.ping();
    for (const name of QUEUES) {
      // Share the non-blocking client; skipMetasUpdate so we do not overwrite
      // bull:<queue>:meta (e.g. streams.events.maxLen set by the app).
      const queue = new Queue(name, {
        connection: redis,
        skipMetasUpdate: true,
      });
      queues.push(queue);
      const completed = await drainState(queue, 'completed');
      const failed = await drainState(queue, 'failed');
      const eventsTrimmed = await trimEventsStream(redis, name, 1000);
      console.log(
        JSON.stringify({
          queue: name,
          completed,
          failed,
          eventsTrimmedApprox: eventsTrimmed,
        }),
      );
    }
  } finally {
    // close() only drops BullMQ listeners on a shared client; quit the client after.
    await Promise.all(queues.map((q) => q.close()));
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
