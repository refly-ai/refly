import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { PrismaMetrics } from './prisma.metrics';
import { RedisService } from './redis.service';
import { EncryptionService } from './encryption.service';
import { createObjectStorageServiceFactory, OSS_EXTERNAL, OSS_INTERNAL } from './object-storage';
import { FULLTEXT_SEARCH, createFulltextSearchFactory } from './fulltext-search';
import { VECTOR_SEARCH, createVectorSearchFactory } from './vector-search';

@Module({
  providers: [
    PrismaService,
    PrismaMetrics, // Automatic Prisma query monitoring
    RedisService,
    EncryptionService,
    {
      provide: OSS_EXTERNAL,
      useFactory: createObjectStorageServiceFactory({ visibility: 'public' }),
      inject: [ConfigService],
    },
    {
      provide: OSS_INTERNAL,
      useFactory: createObjectStorageServiceFactory({ visibility: 'private' }),
      inject: [ConfigService],
    },
    {
      provide: FULLTEXT_SEARCH,
      useFactory: createFulltextSearchFactory(),
      inject: [PrismaService, ConfigService],
    },
    {
      provide: VECTOR_SEARCH,
      useFactory: createVectorSearchFactory(),
      inject: [ConfigService],
    },
  ],
  exports: [
    PrismaService,
    RedisService,
    EncryptionService,
    OSS_EXTERNAL,
    OSS_INTERNAL,
    FULLTEXT_SEARCH,
    VECTOR_SEARCH,
  ],
})
export class CommonModule {}
