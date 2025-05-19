import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import { Client } from 'minio';
import { ObjectInfo, ObjectStorageBackend } from './interface';

export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

@Injectable()
export class MinioStorageBackend implements ObjectStorageBackend {
  private readonly logger = new Logger(MinioStorageBackend.name);
  private client: Client;
  private initialized = false;

  constructor(
    private readonly config: MinioConfig,
    private readonly options: {
      reclaimPolicy: string;
    },
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.config) {
      throw new Error('Minio config is not set');
    }

    this.client = new Client({
      endPoint: this.config.endPoint,
      port: this.config.port,
      useSSL: this.config.useSSL,
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
    });

    try {
      const bucketExists = await this.client.bucketExists(this.config.bucket);

      if (!bucketExists) {
        await this.client.makeBucket(this.config.bucket);
        this.logger.log(`Bucket '${this.config.bucket}' created`);
      }

      this.initialized = true;
      this.logger.log('Minio storage backend initialized');
    } catch (error) {
      // If bucket already exists in any form, just log and continue
      if (error?.code === 'BucketAlreadyExists' || error?.code === 'BucketAlreadyOwnedByYou') {
        this.logger.log(`Bucket ${this.config.bucket} already exists`);
        this.initialized = true;
        return;
      }

      this.logger.error(`Failed to initialize Minio storage backend: ${error}`);
      throw error;
    }
  }

  async getObject(key: string): Promise<Readable | null> {
    try {
      return await this.client.getObject(this.config.bucket, key);
    } catch (error) {
      if (error?.code === 'NoSuchKey') {
        return null;
      }
      this.logger.error(`Failed to get object with key ${key}`, error);
      throw error;
    }
  }

  async presignedGetObject(key: string, expiresIn: number): Promise<string | null> {
    try {
      return await this.client.presignedGetObject(this.config.bucket, key, expiresIn);
    } catch (error) {
      this.logger.error(`Failed to get presigned URL for object with key ${key}`, error);
      throw error;
    }
  }

  async putObject(
    key: string,
    stream: Readable | Buffer | string,
    metaData?: Record<string, string>,
  ): Promise<ObjectInfo> {
    try {
      await this.client.putObject(this.config.bucket, key, stream, metaData);

      const stat = await this.client.statObject(this.config.bucket, key);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        metaData: stat.metaData,
      };
    } catch (error) {
      this.logger.error(`Failed to put object with key ${key}`, error);
      throw error;
    }
  }

  async removeObject(key: string, force?: boolean): Promise<boolean> {
    if (!force && this.options?.reclaimPolicy !== 'delete') {
      this.logger.log(
        `Object ${key} will not be deleted because reclaim policy is ${this.options?.reclaimPolicy}`,
      );
      return false;
    }

    try {
      // Check if object exists before trying to remove
      try {
        await this.client.statObject(this.config.bucket, key);
      } catch (error) {
        if (error?.code === 'NoSuchKey') {
          return false;
        }
        throw error;
      }

      await this.client.removeObject(this.config.bucket, key);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove object with key ${key}`, error);
      throw error;
    }
  }

  async removeObjects(keys: string[], force?: boolean): Promise<boolean> {
    if (!force && this.options?.reclaimPolicy !== 'delete') {
      this.logger.log(
        `Objects ${keys.join(', ')} will not be deleted because reclaim policy is ${this.options?.reclaimPolicy}`,
      );
      return false;
    }

    try {
      await this.client.removeObjects(this.config.bucket, keys);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove objects with keys ${keys}`, error);
      throw error;
    }
  }

  async statObject(key: string): Promise<ObjectInfo | null> {
    try {
      return await this.client.statObject(this.config.bucket, key);
    } catch (error) {
      if (error?.code === 'NoSuchKey') {
        return null;
      }

      this.logger.error(`Failed to stat object with key ${key}`, error);
      throw error;
    }
  }

  async duplicateFile(sourceKey: string, targetKey: string): Promise<ObjectInfo | null> {
    try {
      const sourceStream = await this.client.getObject(this.config.bucket, sourceKey);

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
            `Source object ${sourceKey} is empty or doesn't exist, skipping duplication`,
          );
          return null;
        }

        // If we have content, create a new stream from the buffer and upload it
        await this.client.putObject(this.config.bucket, targetKey, Readable.from(buffer));
      } else {
        // Normal case - put the stream directly
        await this.client.putObject(this.config.bucket, targetKey, sourceStream);
      }

      // Get the new object's info
      const stat = await this.client.statObject(this.config.bucket, targetKey);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
      };
    } catch (error) {
      this.logger.error(`Failed to duplicate file from ${sourceKey} to ${targetKey}`, error);
      throw error;
    }
  }
}
