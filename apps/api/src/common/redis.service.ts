import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  constructor(private configService: ConfigService) {
    super({
      host: configService.getOrThrow('redis.host'),
      port: configService.getOrThrow('redis.port'),
      password: configService.get('redis.password') || undefined,
    });
  }

  async onModuleInit() {
    const initPromise = this.ping();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(`Redis connection timed out after ${this.INIT_TIMEOUT}ms`);
      }, this.INIT_TIMEOUT);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
      this.logger.log('Redis connection established');
    } catch (error) {
      this.logger.error(`Failed to establish Redis connection: ${error}`);
      throw error;
    }
  }

  async acquireLock(key: string) {
    try {
      const token = `${process.pid}-${Date.now()}`;
      const success = await this.set(key, token, 'EX', 10, 'NX');

      if (success) {
        return async () => await this.releaseLock(key, token);
      }
      return null;
    } catch (err) {
      this.logger.warn('Error acquiring lock:', err);
      return null;
    }
  }

  async releaseLock(key: string, token: string) {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const success = await this.eval(script, 1, key, token);

      if (success === 1) {
        return true;
      }
      return false;
    } catch (err) {
      this.logger.error('Error releasing lock:', err);
      throw false;
    }
  }
}
