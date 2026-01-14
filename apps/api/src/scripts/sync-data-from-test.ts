import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';
import crypto from 'node:crypto';

/**
 * Data synchronization script for transferring encrypted data from test environment to local development
 *
 * This script implements the "decrypt-then-re-encrypt" strategy to handle encrypted fields
 * when synchronizing data between environments with different ENCRYPTION_KEY values.
 *
 * Usage (from project root):
 * TEST_ENV_DATABASE_URL=<test-db-url> TEST_ENV_ENCRYPTION_KEY=<test-key> \
 * pnpm --filter @refly/api exec ts-node -r tsconfig-paths/register src/scripts/sync-data-from-test.ts
 *
 * Or from apps/api directory:
 * cd apps/api
 * TEST_ENV_DATABASE_URL=<test-db-url> TEST_ENV_ENCRYPTION_KEY=<test-key> \
 * pnpm exec ts-node -r tsconfig-paths/register src/scripts/sync-data-from-test.ts
 */

// ========== Sync Configuration ==========

interface SyncConfig {
  table: string;
  where: any;
  encryptedFields: string[];
  idField: string;
}

const SYNC_CONFIGS: SyncConfig[] = [
  {
    table: 'toolset',
    where: { key: 'perplexity' },
    encryptedFields: ['authData'],
    idField: 'toolsetId', // Use toolsetId as unique identifier for upsert
  },
];

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

// ========== Main Sync Function ==========

async function syncData() {
  const logger = new Logger('DataSyncScript');

  // ========== Environment Variables Validation ==========
  const sourceDbUrl = process.env.TEST_ENV_DATABASE_URL;
  const sourceEncryptionKey = process.env.TEST_ENV_ENCRYPTION_KEY;
  const targetDbUrl = process.env.DATABASE_URL; // Local database URL
  const targetEncryptionKey = process.env.ENCRYPTION_KEY; // Local encryption key

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

  logger.log('🚀 Starting data synchronization...');
  logger.log(`📊 Source DB: ${finalSourceDbUrl.replace(/:[^:@]+@/, ':****@')}`);
  logger.log(`📊 Target DB: ${targetDbUrl?.replace(/:[^:@]+@/, ':****@') || 'default'}`);

  // ========== Initialize Prisma Clients ==========
  const sourcePrisma = new PrismaClient({
    datasources: {
      db: {
        url: finalSourceDbUrl,
      },
    },
  });

  const targetPrisma = new PrismaClient({
    datasources: {
      db: {
        url: targetDbUrl,
      },
    },
  });

  // ========== Initialize Encryption Services ==========
  const sourceEncryption = new EncryptionService(sourceEncryptionKey, 'TEST_ENV_ENCRYPTION_KEY');
  const targetEncryption = new EncryptionService(targetEncryptionKey, 'ENCRYPTION_KEY');

  try {
    await sourcePrisma.$connect();
    await targetPrisma.$connect();
    logger.log('✅ Database connections established');

    // ========== Process Each Sync Config ==========
    for (const config of SYNC_CONFIGS) {
      logger.log(`\n📦 Processing table: ${config.table}`);
      logger.log(`   Filter: ${JSON.stringify(config.where)}`);

      try {
        // Get data from source database
        logger.log(
          `   Querying: sourcePrisma.${config.table}.findMany({ where: ${JSON.stringify(config.where)} })`,
        );
        const sourceData = await (sourcePrisma[config.table] as any).findMany({
          where: config.where,
        });

        logger.log(`   Query result: ${sourceData?.length || 0} records found`);

        if (!sourceData || sourceData.length === 0) {
          logger.warn(`⚠️  No data found in source database for table: ${config.table}`);
          logger.log('   Trying to query all records without filter...');
          const allData = await (sourcePrisma[config.table] as any).findMany();
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
            logger.log(`\n   Processing record with ${config.idField}=${record[config.idField]}`);

            // Create a copy of the record for transformation
            const transformedRecord = { ...record };

            // Remove the auto-increment pk field to avoid conflicts
            transformedRecord.pk = undefined;

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

            // Upsert into target database using the unique identifier field
            const whereClause = { [config.idField]: record[config.idField] };

            await (targetPrisma[config.table] as any).upsert({
              where: whereClause,
              update: transformedRecord,
              create: transformedRecord,
            });

            logger.log('     ✅ Successfully synced record');
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

    logger.log('\n\n🎉 Data synchronization completed!');
  } catch (error) {
    logger.error(`❌ Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  } finally {
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
    logger.log('👋 Database connections closed');
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
