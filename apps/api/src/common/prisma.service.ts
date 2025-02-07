import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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

  async onModuleInit() {
    const initPromise = this.connectToDatabase();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(`Database connection timed out after ${this.INIT_TIMEOUT}ms`);
      }, this.INIT_TIMEOUT);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
      this.logger.log('Database connection initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize database connection: ${error}`);
      throw error;
    }
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
