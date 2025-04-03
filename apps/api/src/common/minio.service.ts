import { MinioConfig } from '@/config/app.config';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import { Readable } from 'node:stream';

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
          // Special handling for getObject method
          if (prop === 'getObject') {
            return async (...args: any[]) => {
              try {
                return await value.call(target, this.config.bucket, ...args);
              } catch (error: any) {
                // If object doesn't exist, return empty stream instead of throwing
                if (error?.code === 'NoSuchKey' || error?.code === 'NotFound') {
                  this.logger.warn(
                    `Object not found: ${args[0] ?? 'unknown key'}, returning empty data`,
                  );
                  return Readable.from(Buffer.from(''));
                }

                // For all other errors, try without bucket or re-throw
                try {
                  return await value.call(target, ...args);
                } catch (innerError: any) {
                  if (innerError?.code === 'NoSuchKey' || innerError?.code === 'NotFound') {
                    this.logger.warn(
                      `Object not found (direct call): ${args[0] ?? 'unknown key'}, returning empty data`,
                    );
                    return Readable.from(Buffer.from(''));
                  }
                  throw innerError;
                }
              }
            };
          }

          // Default handling for other methods
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
    } catch (error) {
      this.logger.error(`Failed to initialize Minio bucket ${this.config.bucket}: ${error}`);
      throw error;
    }
  }

  async initializeBuckets() {
    try {
      const exists = await this._client.bucketExists(this.config.bucket);
      if (!exists) {
        this.logger.log(`Bucket ${this.config.bucket} does not exist, try to create it`);
        await this._client.makeBucket(this.config.bucket);
      }
      this.logger.log(`Bucket ${this.config.bucket} initialized`);
    } catch (error: any) {
      // If bucket already exists in any form, just log and continue
      if (error?.code === 'BucketAlreadyExists' || error?.code === 'BucketAlreadyOwnedByYou') {
        this.logger.log(`Bucket ${this.config.bucket} already exists`);
        return;
      }
      this.logger.error(`Failed to create bucket ${this.config.bucket}: ${error?.message}`);
      throw error;
    }
  }

  // Expose the bucketless client
  get client(): ProxiedMinioClient {
    return this.proxiedClient;
  }

  /**
   * Duplicate a file from one storage key to another
   * @param sourceStorageKey The source storage key
   * @param targetStorageKey The target storage key
   * @returns the target object info or null if source doesn't exist
   */
  async duplicateFile(sourceStorageKey: string, targetStorageKey: string) {
    const sourceStream = await this.client.getObject(sourceStorageKey);

    // Check if we got an empty stream from a non-existent object
    if (sourceStream instanceof Readable) {
      // Convert to buffer to check if it's empty
      const chunks: Buffer[] = [];
      for await (const chunk of sourceStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        this.logger.warn(
          `Source object ${sourceStorageKey} is empty or doesn't exist, skipping duplication`,
        );
        return null;
      }

      // If we have content, create a new stream from the buffer and upload it
      return await this.client.putObject(targetStorageKey, Readable.from(buffer));
    }

    // Normal case - put the stream directly
    return await this.client.putObject(targetStorageKey, sourceStream);
  }
}
