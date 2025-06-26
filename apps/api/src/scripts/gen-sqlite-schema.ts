import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MAIN_SCHEMA_PATH = path.resolve(__dirname, '../../prisma/schema.prisma');
const SQLITE_SCHEMA_PATH = path.resolve(__dirname, '../../prisma/sqlite-schema.prisma');

function synchronizeSqliteSchema() {
  console.log('Synchronizing Prisma schema to SQLite schema...');

  // Read the main schema file
  let mainSchema = fs.readFileSync(MAIN_SCHEMA_PATH, 'utf8');

  // Make the required modifications

  // 1. Change the datasource provider to sqlite
  mainSchema = mainSchema.replace(
    /datasource db {[^}]*provider\s*=\s*"postgresql"[^}]*}/s,
    'datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}',
  );

  // 2. Change only BigInt types in @id annotations to Int
  mainSchema = mainSchema.replace(/pk\s+BigInt\s+@id/g, 'pk Int @id');

  // 3. Remove all @db.Timestamptz() notations
  mainSchema = mainSchema.replace(/@db\.Timestamptz\(\)/g, '');

  // 4. Remove all other database specific attributes
  mainSchema = mainSchema.replace(/@db\.[a-zA-Z0-9()]+/g, '');

  // Write the modified schema to the SQLite schema file
  fs.writeFileSync(SQLITE_SCHEMA_PATH, mainSchema);

  // Format the SQLite schema file
  execSync(`npx prisma format --schema=${SQLITE_SCHEMA_PATH}`, {
    stdio: 'inherit',
  });

  console.log('Schema synchronization completed successfully!');
  console.log(`SQLite schema written to: ${SQLITE_SCHEMA_PATH}`);
}

// Execute the function if this script is run directly
if (require.main === module) {
  synchronizeSqliteSchema();
}
