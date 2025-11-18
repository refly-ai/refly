import { Readable } from 'node:stream';

export interface ObjectInfo {
  size: number;
  lastModified: Date;
  etag?: string;
  metaData?: Record<string, string>;
}

export interface ObjectStorageBackend {
  /**
   * Initialize the storage backend
   */
  initialize(): Promise<void>;

  /**
   * Get an object from storage
   * @param key The storage key
   * @returns A readable stream of the object or null if it doesn't exist
   */
  getObject(key: string): Promise<Readable | null>;

  /**
   * Get a presigned URL for an object
   * @param key The storage key
   * @param expiresIn The expiration time in seconds
   * @returns A presigned URL for the object or null if it doesn't exist
   */
  presignedGetObject(key: string, expiresIn: number): Promise<string | null>;

  /**
   * Put an object into storage
   * @param key The storage key
   * @param stream The object data as a readable stream
   * @param metaData The metadata of the object
   * @returns The object info
   */
  putObject(
    key: string,
    stream: Readable | Buffer | string,
    metaData?: Record<string, string>,
  ): Promise<ObjectInfo>;

  /**
   * Remove an object from storage
   * @param key The storage key
   * @param force Whether to force the removal of the object
   * @returns true if the object was removed, false if it didn't exist
   */
  removeObject(key: string, force?: boolean): Promise<boolean>;

  /**
   * Remove multiple objects from storage
   * @param keys The storage keys
   * @param force Whether to force the removal of the objects
   * @returns true if the objects were removed, false if they didn't exist
   */
  removeObjects(keys: string[], force?: boolean): Promise<boolean>;

  /**
   * Get object info
   * @param key The storage key
   * @returns The object info or null if it doesn't exist
   */
  statObject(key: string): Promise<ObjectInfo | null>;

  /**
   * Duplicate a file from one storage key to another
   * @param sourceKey The source storage key
   * @param targetKey The target storage key
   * @returns the target object info or null if source doesn't exist
   */
  duplicateFile(sourceKey: string, targetKey: string): Promise<ObjectInfo | null>;

  /**
   * Move an object from one storage key to another
   * @param sourceKey The source storage key
   * @param targetKey The target storage key
   * @returns the target object info or null if source doesn't exist
   */
  moveObject(sourceKey: string, targetKey: string): Promise<ObjectInfo | null>;
}
