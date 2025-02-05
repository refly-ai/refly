import { MinioConfig } from '@/config/app.config';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';

// Internal object storage, which is private and only consumed by api server
export const MINIO_INTERNAL = 'minio-internal';

// External object storage, which is typically public and allow anonymous access
export const MINIO_EXTERNAL = 'minio-external';

type ProxiedMinioClient = {
  [K in keyof MinioClient]: MinioClient[K] extends (bucket: string, ...args: infer P) => infer R
    ? (...args: P) => R
    : MinioClient[K];
};

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private _client: MinioClient;
  private proxiedClient: ProxiedMinioClient;
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  constructor(@Inject('MINIO_CONFIG') private config: MinioConfig) {
    this._client = new MinioClient({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });

    this.proxiedClient = new Proxy(this._client, {
      get: (target, prop: keyof MinioClient) => {
        const value = target[prop];
        if (typeof value === 'function') {
          return (...args: any[]) => {
            try {
              return value.call(target, this.config.bucket, ...args);
            } catch (_error) {
              return value.call(target, ...args);
            }
          };
        }
        return value;
      },
    }) as unknown as ProxiedMinioClient;
  }

  async onModuleInit() {
    const initPromise = this.initializeBuckets();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(`Minio initialization timed out after ${this.INIT_TIMEOUT}ms`);
      }, this.INIT_TIMEOUT);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
      this.logger.log('Minio buckets initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Minio buckets: ${error}`);
      throw error;
    }
  }

  async initializeBuckets() {
    try {
      await this._client.makeBucket(this.config.bucket);
      this.logger.log(`Bucket ${this.config.bucket} created successfully`);
    } catch (error: any) {
      // If bucket already exists in any form, just log and continue
      if (error?.code === 'BucketAlreadyExists' || error?.code === 'BucketAlreadyOwnedByYou') {
        this.logger.log(`Bucket ${this.config.bucket} already exists`);
        return;
      }
      this.logger.error(`Failed to create bucket: ${error?.message}`);
      throw error;
    }
  }

  // Expose the bucketless client
  get client(): ProxiedMinioClient {
    return this.proxiedClient;
  }
}
