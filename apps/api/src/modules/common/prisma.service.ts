import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { runModuleInitWithTimeoutAndRetry } from '@refly/utils';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private logger = new Logger(PrismaService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  constructor() {
    super({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      async () => {
        await this.connectToDatabase();
        this.logger.log('Database connection initialized successfully');
      },
      {
        logger: this.logger,
        label: 'PrismaService.onModuleInit',
        timeoutMs: this.INIT_TIMEOUT,
      },
    );
  }

  async connectToDatabase() {
    await this.$connect();
    this.logger.log('Connected to database');

    this.$on('query' as never, (e: any) => {
      if (process.env.NODE_ENV === 'production') {
        const normalizedQuery = typeof e.query === 'string' ? e.query.trim().toLowerCase() : '';
        const isWriteQuery =
          normalizedQuery.startsWith('insert') ||
          normalizedQuery.startsWith('update') ||
          normalizedQuery.startsWith('delete');
        if (isWriteQuery) {
          // Never log params in production — they often contain tokens/API keys/PII.
          // Only log a short query prefix + duration for operational signal.
          const query =
            typeof e.query === 'string' ? this.truncateForLog(e.query, 200) : String(e.query ?? '');
          this.logger.log(`query: ${query}, duration: ${e.duration}ms`);
        }
      }
    });
  }

  private truncateForLog(value: string, maxLen: number): string {
    if (value.length <= maxLen) {
      return value;
    }
    return `${value.slice(0, maxLen)}...[truncated ${value.length - maxLen} chars]`;
  }
}
