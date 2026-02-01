import crypto from 'node:crypto';

const OPENAPI_FILE_KEY_PREFIX = 'of_';
const OPENAPI_STORAGE_PREFIX = 'openapi';
const OPENAPI_FILE_KEY_BYTES = 16;

export const generateOpenapiFileKey = (uid: string, buffer: Buffer): string => {
  const hash = crypto.createHash('sha256').update(uid).update('\n').update(buffer).digest();
  const shortHash = hash.subarray(0, OPENAPI_FILE_KEY_BYTES).toString('base64url');
  return `${OPENAPI_FILE_KEY_PREFIX}${shortHash}`;
};

const isOpenapiFileKey = (value?: string | null): boolean => {
  return !!value && value.startsWith(OPENAPI_FILE_KEY_PREFIX);
};

export const buildOpenapiStorageKey = (uid: string, fileKey: string): string => {
  return `${OPENAPI_STORAGE_PREFIX}/${uid}/${fileKey}`;
};

export const normalizeOpenapiStorageKey = (
  uid: string,
  storageKey?: string | null,
): string | undefined => {
  if (!storageKey) return undefined;
  if (storageKey.startsWith(`${OPENAPI_STORAGE_PREFIX}/`)) return storageKey;
  if (isOpenapiFileKey(storageKey)) return buildOpenapiStorageKey(uid, storageKey);
  return storageKey;
};
