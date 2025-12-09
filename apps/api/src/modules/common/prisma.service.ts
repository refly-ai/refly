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
        this.logger.log(`query: ${e.query}, param: ${e.params}, duration: ${e.duration}ms`);
      }
    });
  }
}
