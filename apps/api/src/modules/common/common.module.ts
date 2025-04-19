import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { QdrantService } from './qdrant.service';
import { createObjectStorageServiceFactory, OSS_EXTERNAL, OSS_INTERNAL } from './object-storage';
import { FULLTEXT_SEARCH, createFulltextSearchFactory } from './fulltext-search';

@Module({
  providers: [
    PrismaService,
    RedisService,
    QdrantService,
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
  ],
  exports: [
    PrismaService,
    RedisService,
    QdrantService,
    OSS_EXTERNAL,
    OSS_INTERNAL,
    FULLTEXT_SEARCH,
  ],
})
export class CommonModule {}
