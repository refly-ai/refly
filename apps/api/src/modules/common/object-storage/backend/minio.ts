import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import { Client, CopyConditions } from 'minio';
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

  private normalizeObjectKey(key: string): string {
    // MinIO expects object names without a leading slash.
    const normalizedKey = key.replace(/\/+/g, '/');
    return normalizedKey.startsWith('/') ? normalizedKey.slice(1) : normalizedKey;
  }

  private isNotFoundError(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    const statusCode = (error as { statusCode?: number })?.statusCode;
    const message = (error as { message?: string })?.message ?? '';

    if (statusCode === 404) {
      return true;
    }

    // MinIO/minio-js may surface missing objects/buckets with different codes/messages.
    if (code === 'NoSuchKey' || code === 'NotFound' || code === 'NoSuchBucket') {
      return true;
    }

    return (
      message.includes('Not Found') ||
      message.includes('The specified key does not exist') ||
      message.includes('NoSuchKey') ||
      message.includes('NoSuchBucket')
    );
  }

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
    const objectKey = this.normalizeObjectKey(key);
    try {
      return await this.client.getObject(this.config.bucket, objectKey);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      this.logger.error(`Failed to get object with key ${objectKey}`, error);
      throw error;
    }
  }

  async presignedGetObject(key: string, expiresIn: number): Promise<string | null> {
    const objectKey = this.normalizeObjectKey(key);
    try {
      return await this.client.presignedGetObject(this.config.bucket, objectKey, expiresIn);
    } catch (error) {
      this.logger.error(
        `Failed to get presigned URL for object with key ${objectKey}: ${error?.stack}`,
      );
      throw error;
    }
  }

  async putObject(
    key: string,
    stream: Readable | Buffer | string,
    metaData?: Record<string, string>,
  ): Promise<ObjectInfo> {
    const objectKey = this.normalizeObjectKey(key);
    try {
      await this.client.putObject(this.config.bucket, objectKey, stream, metaData);

      const stat = await this.client.statObject(this.config.bucket, objectKey);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        metaData: stat.metaData,
      };
    } catch (error) {
      this.logger.error(`Failed to put object with key ${objectKey}: ${error?.stack}`);
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

    const objectKey = this.normalizeObjectKey(key);
    try {
      // Check if object exists before trying to remove
      try {
        await this.client.statObject(this.config.bucket, objectKey);
      } catch (error) {
        if (this.isNotFoundError(error)) {
          return false;
        }
        throw error;
      }

      await this.client.removeObject(this.config.bucket, objectKey);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove object with key ${objectKey}: ${error?.stack}`);
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
      const objectKeys = keys?.map((key) => this.normalizeObjectKey(key)) ?? [];
      await this.client.removeObjects(this.config.bucket, objectKeys);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove objects with keys ${keys}: ${error.stack}`);
      throw error;
    }
  }

  async statObject(key: string): Promise<ObjectInfo | null> {
    const objectKey = this.normalizeObjectKey(key);
    try {
      return await this.client.statObject(this.config.bucket, objectKey);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      this.logger.error(`Failed to stat object with key ${objectKey}: ${error?.stack}`);
      throw error;
    }
  }

  async duplicateFile(sourceKey: string, targetKey: string): Promise<ObjectInfo | null> {
    try {
      const sourceObject = `/${this.config.bucket}/${this.normalizeObjectKey(sourceKey)}`;
      const targetObjectKey = this.normalizeObjectKey(targetKey);

      // Copy the object to the new location
      await this.client.copyObject(
        this.config.bucket,
        targetObjectKey,
        sourceObject,
        new CopyConditions(),
      );

      // Get the new object's info
      const stat = await this.client.statObject(this.config.bucket, targetObjectKey);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
      };
    } catch (error) {
      this.logger.error(
        `Failed to duplicate file from ${sourceKey} to ${targetKey}: ${error?.stack}`,
      );
      throw error;
    }
  }

  async moveObject(sourceKey: string, targetKey: string): Promise<ObjectInfo | null> {
    try {
      const sourceObject = `/${this.config.bucket}/${this.normalizeObjectKey(sourceKey)}`;
      const sourceObjectKey = this.normalizeObjectKey(sourceKey);
      const targetObjectKey = this.normalizeObjectKey(targetKey);

      // Copy the object to the new location
      await this.client.copyObject(
        this.config.bucket,
        targetObjectKey,
        sourceObject,
        new CopyConditions(),
      );

      // Remove the original object
      await this.client.removeObject(this.config.bucket, sourceObjectKey);

      // Get the new object's info
      const stat = await this.client.statObject(this.config.bucket, targetObjectKey);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
      };
    } catch (error) {
      this.logger.error(
        `Failed to move object from ${sourceKey} to ${targetKey}: ${JSON.stringify(error)}`,
      );
      throw error;
    }
  }
}
