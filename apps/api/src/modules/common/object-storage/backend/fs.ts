import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ObjectInfo, ObjectStorageBackend } from './interface';

export interface FsConfig {
  root: string;
}

@Injectable()
export class FsStorageBackend implements ObjectStorageBackend {
  private readonly logger = new Logger(FsStorageBackend.name);
  private baseDir: string;
  private initialized = false;

  constructor(
    private readonly config: FsConfig,
    private readonly options?: { reclaimPolicy?: string },
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.config) {
      throw new Error('Fs config is not set');
    }

    this.baseDir = this.config.root;

    try {
      // Ensure the storage directory exists
      await fs.mkdir(this.baseDir, { recursive: true });
      this.initialized = true;
      this.logger.log(`FS storage backend initialized at ${this.baseDir}`);
    } catch (error) {
      this.logger.error(`Failed to initialize FS storage backend: ${error.stack}`);
      throw error;
    }
  }

  async getObject(key: string): Promise<Readable | null> {
    try {
      const filePath = this.getFilePath(key);

      // Check if the file exists before attempting to create a read stream
      if (!existsSync(filePath)) {
        return null;
      }

      return createReadStream(filePath);
    } catch (error) {
      this.logger.error(`Failed to get object with key ${key}: ${error.stack}`);
      throw error;
    }
  }

  async presignedGetObject(_key: string, _expiresIn: number): Promise<string | null> {
    throw new Error('presignedGetObject is not supported for FS storage backend');
  }

  async putObject(key: string, data: Readable | Buffer | string): Promise<ObjectInfo> {
    try {
      const filePath = this.getFilePath(key);

      // Ensure the directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Handle different input types
      if (Buffer.isBuffer(data) || typeof data === 'string') {
        // For Buffer or string, use fs.writeFile directly
        await fs.writeFile(filePath, data);
        return (await this.statObject(key)) as ObjectInfo;
      }

      if (data instanceof Readable) {
        // For Readable streams, use pipeline for proper error handling
        const writeStream = createWriteStream(filePath);

        try {
          await pipeline(data, writeStream);
          return (await this.statObject(key)) as ObjectInfo;
        } catch (err) {
          // Clean up the file if stream processing failed
          try {
            if (existsSync(filePath)) {
              await fs.unlink(filePath);
            }
          } catch (cleanupErr) {
            this.logger.warn(`Failed to clean up file after stream error: ${filePath}`, cleanupErr);
          }
          throw err;
        }
      }
      throw new TypeError('Input must be a Readable stream, Buffer, or string');
    } catch (error) {
      this.logger.error(`Failed to put object with key ${key}: ${error.stack}`);
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
      const filePath = this.getFilePath(key);

      // Check if the file exists
      if (!existsSync(filePath)) {
        return false;
      }

      await fs.unlink(filePath);

      // Try to remove empty parent directories
      try {
        await this.cleanEmptyDirectories(path.dirname(filePath));
      } catch (err) {
        // Ignore errors when cleaning directories
        this.logger.warn(`Error while cleaning empty directories: ${err.stack}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to remove object with key ${key}: ${error.stack}`);
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
      await Promise.all(keys.map((key) => this.removeObject(key, force)));
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove objects with keys ${keys}: ${error.stack}`);
      throw error;
    }
  }

  async statObject(key: string): Promise<ObjectInfo | null> {
    try {
      const filePath = this.getFilePath(key);

      // Check if the file exists
      if (!existsSync(filePath)) {
        return null;
      }

      const stat = await fs.stat(filePath);
      return {
        size: stat.size,
        lastModified: stat.mtime,
        // Generate an "etag" based on file size and modification time
        etag: `${stat.size}-${stat.mtimeMs}`,
      };
    } catch (error) {
      this.logger.error(`Failed to stat object with key ${key}: ${error.stack}`);
      throw error;
    }
  }

  async duplicateFile(sourceKey: string, targetKey: string): Promise<ObjectInfo | null> {
    try {
      const sourcePath = this.getFilePath(sourceKey);
      const targetPath = this.getFilePath(targetKey);

      // Check if source exists
      if (!existsSync(sourcePath)) {
        return null;
      }

      // Ensure the target directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Copy the file
      await fs.copyFile(sourcePath, targetPath);

      // Get the new file's info
      return await this.statObject(targetKey);
    } catch (error) {
      this.logger.error(
        `Failed to duplicate file from ${sourceKey} to ${targetKey}: ${error.stack}`,
      );
      throw error;
    }
  }

  async moveObject(sourceKey: string, targetKey: string): Promise<ObjectInfo | null> {
    try {
      const sourcePath = this.getFilePath(sourceKey);
      const targetPath = this.getFilePath(targetKey);

      // Check if source exists
      if (!existsSync(sourcePath)) {
        return null;
      }

      // Ensure the target directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Move the file (rename operation)
      await fs.rename(sourcePath, targetPath);

      // Try to remove empty parent directories of the source
      try {
        await this.cleanEmptyDirectories(path.dirname(sourcePath));
      } catch (err) {
        // Ignore errors when cleaning directories
        this.logger.warn(`Error while cleaning empty directories after move: ${err.stack}`);
      }

      // Get the moved file's info
      return await this.statObject(targetKey);
    } catch (error) {
      this.logger.error(`Failed to move object from ${sourceKey} to ${targetKey}: ${error.stack}`);
      throw error;
    }
  }

  private getFilePath(key: string): string {
    // Convert the key into a valid file path
    // Replace consecutive slashes with a single slash
    const normalizedKey = key.replace(/\/+/g, '/');

    // Remove leading slash if present
    const cleanKey = normalizedKey.startsWith('/') ? normalizedKey.slice(1) : normalizedKey;

    return path.join(this.baseDir, cleanKey);
  }

  private async cleanEmptyDirectories(dirPath: string): Promise<void> {
    // Don't delete the base directory
    if (dirPath === this.baseDir) {
      return;
    }

    // Check if directory is empty
    const files = await fs.readdir(dirPath);

    if (files.length === 0) {
      await fs.rmdir(dirPath);

      // Recursively check parent directory
      await this.cleanEmptyDirectories(path.dirname(dirPath));
    }
  }
}
