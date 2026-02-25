import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { findTargetDirectory } from './runtime';

/**
 * Migrates the database schema by generating and applying a diff between
 * the current database state and the Prisma schema file.
 * Requires DATABASE_URL and AUTO_MIGRATE_DB_SCHEMA environment variables.
 */
export const migrateDbSchema = (): void => {
  // Start looking for node_modules from the directory of this script
  const nodeModulesPath =
    findTargetDirectory(__dirname, 'node_modules') ||
    findTargetDirectory(resolve(process.cwd()), 'node_modules') ||
    join(process.cwd(), 'node_modules');

  // Check if the prisma binary exists
  let prismaBin = join(nodeModulesPath, '.bin', 'prisma');

  // Fallback to using pnpm bin if the above approach fails
  if (!existsSync(prismaBin)) {
    console.warn(
      'Could not find Prisma binary using directory traversal, falling back to pnpm bin',
    );

    try {
      const binPath = execSync('pnpm bin', { encoding: 'utf-8' }).trim();
      prismaBin = join(binPath, 'prisma');
    } catch (error) {
      console.error('Failed to execute "pnpm bin" command:', error);
      throw new Error(
        'Could not locate Prisma binary. Please ensure pnpm is installed and the project dependencies are properly set up.',
      );
    }
  }

  const prismaRoot = findTargetDirectory(__dirname, 'prisma');
  if (!prismaRoot) {
    throw new Error('Could not find prisma root directory');
  }

  const prismaSchemaPath = join(prismaRoot, 'schema.prisma');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for auto migration');
  }

  console.log('[MigrateDB] Running prisma migrate diff...');
  const diffSql = execSync(
    `${prismaBin} migrate diff --from-url "${databaseUrl}" --to-schema-datamodel "${prismaSchemaPath}" --script`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'inherit'], timeout: 30_000 },
  );

  if (!diffSql.trim()) {
    console.log('[MigrateDB] Schema is up to date, no migration needed');
    return;
  }

  // Make auto-migration idempotent for startup scenarios:
  // prisma migrate diff may emit CREATE INDEX/TABLE statements that already exist in DB.
  const sanitizedSql = diffSql
    .replace(/CREATE TABLE\s+/gi, 'CREATE TABLE IF NOT EXISTS ')
    .replace(
      /CREATE\s+(UNIQUE\s+)?INDEX\s+("[^"]+"|[^\s]+)\s+ON/gi,
      'CREATE $1INDEX IF NOT EXISTS $2 ON',
    );

  console.log('[MigrateDB] Applying migration...');
  execSync(`${prismaBin} db execute --stdin --url "${databaseUrl}"`, {
    input: sanitizedSql,
    stdio: ['pipe', 'inherit', 'inherit'],
    timeout: 30_000,
  });
  console.log('[MigrateDB] Migration complete');
};

/**
 * Seeds the database by executing SQL files from the seed-data directory.
 * Files are executed in alphabetical order (use numeric prefixes like 001_, 002_).
 * SQL should use ON CONFLICT DO NOTHING for idempotency.
 * Controlled by AUTO_SEED_DATA environment variable.
 */
export const seedDatabase = async (): Promise<void> => {
  const seedDataDir = findTargetDirectory(__dirname, 'seed-data');
  if (!seedDataDir) {
    console.warn('seed-data directory not found, skipping seed');
    return;
  }

  const sqlFiles = readdirSync(seedDataDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (sqlFiles.length === 0) {
    console.log('No SQL seed files found, skipping seed');
    return;
  }

  const prisma = new PrismaClient();

  try {
    for (const file of sqlFiles) {
      const filePath = join(seedDataDir, file);
      const sql = readFileSync(filePath, 'utf-8').trim();
      if (!sql) continue;

      // Split into individual statements since $executeRawUnsafe only supports single statements.
      // Split on semicolons followed by a newline to avoid breaking on semicolons inside string literals.
      const statements = sql
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      try {
        for (const stmt of statements) {
          await prisma.$executeRawUnsafe(stmt.endsWith(';') ? stmt : `${stmt};`);
        }
        console.log(`Seed executed: ${file}`);
      } catch (error) {
        console.error(`Seed failed: ${file}`, error);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
};
