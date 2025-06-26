import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../modules/app.module';
import { PrismaService } from '../modules/common/prisma.service';
import { EncryptionService } from '../modules/common/encryption.service';

/**
 * This script encrypts all existing provider apiKeys in the database.
 * It should be run once to migrate existing data to the new encrypted format.
 *
 * Usage: npx ts-node -r tsconfig-paths/register apps/api/src/scripts/encrypt-provider-api-keys.ts
 */
async function bootstrap() {
  const logger = new Logger('EncryptApiKeysScript');
  logger.log('Starting to encrypt provider API keys');

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const encryptionService = app.get(EncryptionService);

  try {
    // Get all providers
    const providers = await prisma.provider.findMany();
    logger.log(`Found ${providers.length} providers to process`);

    let encryptedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each provider
    for (const provider of providers) {
      try {
        // Skip if apiKey is null, empty, or already appears to be encrypted
        // (We're assuming encrypted strings are longer than 100 characters as a heuristic)
        if (!provider.apiKey || provider.apiKey.length === 0) {
          logger.debug(`Skipping provider ${provider.providerId} - no API key`);
          skippedCount++;
          continue;
        }

        // Attempt to decrypt to see if it's already encrypted (will return null if it can't be decrypted)
        const testDecrypt = encryptionService.decrypt(provider.apiKey);

        if (testDecrypt !== null && testDecrypt !== provider.apiKey) {
          // Already properly encrypted
          logger.debug(`Skipping provider ${provider.providerId} - API key already encrypted`);
          skippedCount++;
          continue;
        }

        // Encrypt the API key
        const encryptedApiKey = encryptionService.encrypt(provider.apiKey);

        // Update the provider
        await prisma.provider.update({
          where: { pk: provider.pk },
          data: { apiKey: encryptedApiKey },
        });

        encryptedCount++;
        logger.debug(`Encrypted API key for provider ${provider.providerId}`);
      } catch (error) {
        errorCount++;
        logger.error(`Error processing provider ${provider.providerId}: ${error.message}`);
      }
    }

    logger.log('Completed encryption process:');
    logger.log(`- Encrypted: ${encryptedCount}`);
    logger.log(`- Skipped: ${skippedCount}`);
    logger.log(`- Errors: ${errorCount}`);
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
  } finally {
    await prisma.$disconnect();
    await app.close();
  }
}

bootstrap()
  .then(() => {
    console.log('API key encryption script completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('API key encryption script failed:', err);
    process.exit(1);
  });
