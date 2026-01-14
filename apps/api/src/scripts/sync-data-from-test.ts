import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * SQL generation script for transferring encrypted data from test environment
 *
 * This script implements the "decrypt-then-re-encrypt" strategy to handle encrypted fields
 * when synchronizing data between environments with different ENCRYPTION_KEY values.
 * It generates SQL INSERT statements instead of directly modifying the target database.
 *
 * Usage (from project root):
 * TEST_ENV_DATABASE_URL=<test-db-url> TEST_ENV_ENCRYPTION_KEY=<test-key> ENCRYPTION_KEY=<target-key> \
 * pnpm --filter @refly/api exec ts-node -r tsconfig-paths/register src/scripts/sync-data-from-test.ts
 *
 * Or from apps/api directory:
 * cd apps/api
 * TEST_ENV_DATABASE_URL=<test-db-url> TEST_ENV_ENCRYPTION_KEY=<test-key> ENCRYPTION_KEY=<target-key> \
 * pnpm exec ts-node -r tsconfig-paths/register src/scripts/sync-data-from-test.ts
 */

// ========== Sync Configuration ==========

interface SyncConfig {
  table: string; // Database table name (e.g., 'toolsets')
  where: any;
  encryptedFields: string[];
}

const SYNC_CONFIGS: SyncConfig[] = [
  {
    table: 'toolsets', // Database table name
    where: { key: 'perplexity' },
    encryptedFields: ['authData'],
  },
];

/**
 * Maps database table names to Prisma model names
 * Handles common pluralization patterns
 */
function getModelNameFromTable(tableName: string): string {
  // Special cases mapping
  const specialCases: Record<string, string> = {
    accounts: 'account',
    users: 'user',
    toolsets: 'toolset',
    providers: 'provider',
    // Add more special cases as needed
  };

  // Check special cases first
  if (specialCases[tableName]) {
    return specialCases[tableName];
  }

  // Default: remove trailing 's' for simple plurals
  if (tableName.endsWith('s')) {
    return tableName.slice(0, -1);
  }

  // If no plural form detected, return as-is
  return tableName;
}

// ========== Encryption Service Implementation ==========

class EncryptionService {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits

  constructor(encryptionKey: string | null, defaultKeyName: string) {
    if (!encryptionKey) {
      console.warn(
        `⚠️  ${defaultKeyName} not provided. Using development default key (NOT SECURE!)`,
      );
      // Default key for development only - 32 bytes (256 bits)
      this.encryptionKey = crypto.scryptSync('development-key-not-secure', 'salt', this.keyLength);
    } else {
      // Convert the hex string to a Buffer
      this.encryptionKey = Buffer.from(encryptionKey, 'hex');

      // Validate key length
      if (this.encryptionKey.length !== this.keyLength) {
        throw new Error(
          `Encryption key must be ${this.keyLength * 2} hex characters (${this.keyLength} bytes)`,
        );
      }
    }
  }

  /**
   * Encrypts a string using AES-256-GCM
   * @param text The text to encrypt
   * @returns The encrypted text as a hex string with IV and auth tag prepended
   */
  encrypt(text: string | null | undefined): string | null {
    if (text === null || text === undefined) {
      return null;
    }

    if (text === '') {
      return '';
    }

    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      // Encrypt the data
      const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV, encrypted data, and auth tag
      return Buffer.concat([iv, authTag, encrypted]).toString('hex');
    } catch (error) {
      console.error(`❌ Error encrypting data: ${error.message}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts a string that was encrypted with the encrypt method
   * @param encryptedText The encrypted text as a hex string with IV and auth tag prepended
   * @returns The decrypted text
   */
  decrypt(encryptedText: string | null | undefined): string | null {
    if (encryptedText === null || encryptedText === undefined) {
      return null;
    }

    if (encryptedText === '') {
      return '';
    }

    try {
      // Convert the hex string to a Buffer
      const data = Buffer.from(encryptedText, 'hex');

      // Extract IV, auth tag, and encrypted data
      const iv = data.subarray(0, this.ivLength);
      const authTag = data.subarray(this.ivLength, this.ivLength + this.authTagLength);
      const encryptedData = data.subarray(this.ivLength + this.authTagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

      // Set auth tag
      decipher.setAuthTag(authTag);

      // Decrypt the data
      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.warn(`⚠️  Error decrypting data: ${error.message}`);
      return null; // Return null for failed decryption
    }
  }
}

// ========== SQL Generation Helper Functions ==========

/**
 * Converts camelCase field name to snake_case column name
 * Used to map Prisma field names to database column names
 */
function camelToSnakeCase(fieldName: string): string {
  return fieldName.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Escapes a string value for SQL insertion
 * Handles single quotes and backslashes
 */
function escapeSqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * Converts a JavaScript value to SQL literal format
 * @param value The value to convert
 * @returns SQL literal representation
 */
function valueToSqlLiteral(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    return `'${escapeSqlString(value)}'`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  if (typeof value === 'object') {
    // Convert objects to JSON strings
    return `'${escapeSqlString(JSON.stringify(value))}'`;
  }

  // Fallback: convert to string
  return `'${escapeSqlString(String(value))}'`;
}

/**
 * Generates an INSERT SQL statement for a record
 * @param tableName The name of the table
 * @param record The record to insert
 * @returns SQL INSERT statement
 */
function generateInsertSql(tableName: string, record: Record<string, any>): string {
  // Filter out undefined values and the pk field
  const fields = Object.keys(record).filter((key) => key !== 'pk' && record[key] !== undefined);

  // Generate column names (with double quotes for PostgreSQL)
  // Convert camelCase Prisma field names to snake_case database column names
  const columns = fields.map((field) => `"${camelToSnakeCase(field)}"`).join(', ');

  // Generate values
  const values = fields.map((field) => valueToSqlLiteral(record[field])).join(', ');

  // Generate INSERT statement
  return `INSERT INTO "refly"."${tableName}" (\n  ${columns}\n) VALUES (\n  ${values}\n);`;
}

// ========== Main Sync Function ==========

async function syncData() {
  const logger = new Logger('DataSyncScript');

  // ========== Environment Variables Validation ==========
  const sourceDbUrl = process.env.TEST_ENV_DATABASE_URL?.trim();
  const sourceEncryptionKey = process.env.TEST_ENV_ENCRYPTION_KEY?.trim();
  const targetEncryptionKey = process.env.ENCRYPTION_KEY?.trim(); // Target encryption key for re-encryption

  if (!sourceDbUrl) {
    logger.error('❌ TEST_ENV_DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Add schema parameter to source database URL if not already present
  let finalSourceDbUrl = sourceDbUrl;
  if (!sourceDbUrl.includes('schema=')) {
    const separator = sourceDbUrl.includes('?') ? '&' : '?';
    finalSourceDbUrl = `${sourceDbUrl}${separator}schema=refly`;
  }

  // ========== Setup Output File ==========
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const outputDir = path.join(process.cwd(), 'scripts', 'output');
  const outputFile = path.join(outputDir, `sync-data-${timestamp}.sql`);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  logger.log('🚀 Starting SQL generation for data synchronization...');
  logger.log(`📊 Source DB: ${finalSourceDbUrl.replace(/:[^:@]+@/, ':****@')}`);
  logger.log(`📄 Output file: ${outputFile}`);

  // ========== Initialize Prisma Client (Source Only) ==========
  const sourcePrisma = new PrismaClient({
    datasources: {
      db: {
        url: finalSourceDbUrl,
      },
    },
  });

  // ========== Initialize Encryption Services ==========
  const sourceEncryption = new EncryptionService(sourceEncryptionKey, 'TEST_ENV_ENCRYPTION_KEY');
  const targetEncryption = new EncryptionService(targetEncryptionKey, 'ENCRYPTION_KEY');

  // ========== Initialize SQL Output ==========
  const sqlStatements: string[] = [];
  sqlStatements.push('-- Data Synchronization SQL Script');
  sqlStatements.push(`-- Generated at: ${new Date().toISOString()}`);

  // Format source URL in comment, ensure it stays on one line
  const maskedSourceUrl = finalSourceDbUrl.replace(/:[^:@]+@/, ':****@');
  sqlStatements.push(`-- Source: ${maskedSourceUrl}`);

  sqlStatements.push('--');
  sqlStatements.push('-- WARNING: Please review this SQL carefully before executing!');
  sqlStatements.push('-- This script contains re-encrypted sensitive data.');
  sqlStatements.push('--');
  sqlStatements.push('');
  sqlStatements.push('BEGIN;');
  sqlStatements.push('');

  try {
    await sourcePrisma.$connect();
    logger.log('✅ Database connection established');

    // ========== Process Each Sync Config ==========
    for (const config of SYNC_CONFIGS) {
      const modelName = getModelNameFromTable(config.table);

      logger.log(`\n📦 Processing table: ${config.table} (model: ${modelName})`);
      logger.log(`   Filter: ${JSON.stringify(config.where)}`);

      sqlStatements.push(`-- Sync data for table: ${config.table}`);
      sqlStatements.push(`-- Filter: ${JSON.stringify(config.where)}`);
      sqlStatements.push('');

      try {
        // Get data from source database using Prisma model name
        logger.log(
          `   Querying: sourcePrisma.${modelName}.findMany({ where: ${JSON.stringify(config.where)} })`,
        );
        const sourceData = await (sourcePrisma[modelName] as any).findMany({
          where: config.where,
        });

        logger.log(`   Query result: ${sourceData?.length || 0} records found`);

        if (!sourceData || sourceData.length === 0) {
          logger.warn(`⚠️  No data found in source database for table: ${config.table}`);
          logger.log('   Trying to query all records without filter...');
          const allData = await (sourcePrisma[modelName] as any).findMany();
          logger.log(`   Total records in table: ${allData?.length || 0}`);
          if (allData?.length > 0) {
            logger.log(
              `   Sample record keys: ${allData
                .slice(0, 3)
                .map((r) => r.key || r.pk)
                .join(', ')}`,
            );
          }
          continue;
        }

        logger.log(`   Found ${sourceData.length} record(s) in source database`);

        // Process each record
        for (const record of sourceData) {
          try {
            // Get a unique identifier for logging (try common fields)
            const recordId =
              record.toolsetId || record.id || record.uuid || record.key || record.pk;
            logger.log(`\n   Processing record with id=${recordId}`);

            // Create a copy of the record for transformation
            const transformedRecord = { ...record };

            // Decrypt and re-encrypt sensitive fields
            for (const field of config.encryptedFields) {
              if (transformedRecord[field]) {
                // Decrypt using source key
                const decrypted = sourceEncryption.decrypt(transformedRecord[field]);

                if (decrypted === null) {
                  logger.warn(`     ⚠️  Failed to decrypt field: ${field}, skipping re-encryption`);
                  continue;
                }

                logger.log(`     🔓 Decrypted field: ${field}`);

                // Re-encrypt using target key
                const reencrypted = targetEncryption.encrypt(decrypted);
                transformedRecord[field] = reencrypted;

                logger.log(`     🔐 Re-encrypted field: ${field}`);
              }
            }

            // Generate INSERT SQL statement
            const insertSql = generateInsertSql(config.table, transformedRecord);
            sqlStatements.push(insertSql);
            sqlStatements.push('');

            logger.log('     ✅ Generated SQL for record');
          } catch (error) {
            logger.error(`     ❌ Error processing record: ${error.message}`);
            logger.error(error.stack);
          }
        }

        logger.log(`\n✅ Completed processing table: ${config.table}`);
      } catch (error) {
        logger.error(`❌ Error processing table ${config.table}: ${error.message}`);
        logger.error(error.stack);
      }
    }

    // ========== Write SQL to File ==========
    sqlStatements.push('COMMIT;');
    sqlStatements.push('');
    sqlStatements.push('-- End of SQL script');

    fs.writeFileSync(outputFile, sqlStatements.join('\n'), 'utf8');

    logger.log('\n\n🎉 SQL generation completed!');
    logger.log(`📄 Output file: ${outputFile}`);
    logger.log(
      '\n⚠️  IMPORTANT: Please review the SQL file carefully before executing it manually.',
    );
  } catch (error) {
    logger.error(`❌ Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  } finally {
    await sourcePrisma.$disconnect();
    logger.log('👋 Database connection closed');
  }
}

// ========== Script Entry Point ==========

syncData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
