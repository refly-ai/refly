import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import { FileVisibility } from '@refly/openapi-schema';
import { FsStorageBackend } from './backend/fs';
import { MinioStorageBackend } from './backend/minio';
import { ObjectInfo, ObjectStorageBackend } from './backend/interface';

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);

  constructor(private readonly storageBackend: ObjectStorageBackend) {}

  async onModuleInit() {
    await this.storageBackend.initialize();
    this.logger.log('Object storage service initialized');
  }

  /**
   * Get an object from storage
   * @param key The storage key
   * @returns A readable stream of the object or null if it doesn't exist
   */
  async getObject(key: string): Promise<Readable | null> {
    return this.storageBackend.getObject(key);
  }

  /**
   * Get a presigned URL for an object
   * @param key The storage key
   * @param expiresIn The expiration time in seconds
   * @returns A presigned URL for the object or null if it doesn't exist
   */
  async presignedGetObject(key: string, expiresIn: number): Promise<string | null> {
    return this.storageBackend.presignedGetObject(key, expiresIn);
  }

  /**
   * Put an object into storage
   * @param key The storage key
   * @param stream The object data as a readable stream
   * @param metaData The metadata of the object
   * @returns The object info
   */
  async putObject(
    key: string,
    stream: Readable | Buffer | string,
    metaData?: Record<string, string>,
  ): Promise<ObjectInfo> {
    return this.storageBackend.putObject(key, stream, metaData);
  }

  /**
   * Remove an object from storage
   * @param key The storage key
   * @returns true if the object was removed, false if it didn't exist
   */
  async removeObject(key: string): Promise<boolean> {
    return this.storageBackend.removeObject(key);
  }

  /**
   * Remove multiple objects from storage
   * @param keys The storage keys
   * @returns true if the objects were removed, false if they didn't exist
   */
  async removeObjects(keys: string[]): Promise<boolean> {
    return this.storageBackend.removeObjects(keys);
  }

  /**
   * Get object info
   * @param key The storage key
   * @returns The object info or null if it doesn't exist
   */
  async statObject(key: string): Promise<ObjectInfo | null> {
    return this.storageBackend.statObject(key);
  }

  /**
   * Duplicate a file from one storage key to another
   * @param sourceKey The source storage key
   * @param targetKey The target storage key
   * @returns the target object info or null if source doesn't exist
   */
  async duplicateFile(sourceKey: string, targetKey: string): Promise<ObjectInfo | null> {
    return this.storageBackend.duplicateFile(sourceKey, targetKey);
  }
}

export const createObjectStorageServiceFactory = (options?: { visibility: FileVisibility }) => {
  return (configService: ConfigService) => {
    const backendType = configService.get('objectStorage.backend');
    const reclaimPolicy = configService.get('objectStorage.reclaimPolicy');

    let backend: ObjectStorageBackend;
    switch (backendType) {
      case 'fs':
        backend = new FsStorageBackend(configService.get('objectStorage.fs'), {
          reclaimPolicy,
        });
        break;
      case 'minio': {
        backend = new MinioStorageBackend(
          options?.visibility === 'public'
            ? configService.get('objectStorage.minio.external')
            : configService.get('objectStorage.minio.internal'),
          { reclaimPolicy },
        );
        break;
      }
      default:
        throw new Error(`Unknown storage backend type '${backendType}'`);
    }

    return new ObjectStorageService(backend);
  };
};

// Export the provider tokens
export * from './tokens';
