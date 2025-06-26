import { app } from 'electron';
import path from 'node:path';
import { preparePrismaEnv } from './prisma';

export function prepareEnvironment() {
  const userDataPath = app.getPath('userData');

  process.env.MODE = 'desktop';
  process.env.DATABASE_URL = `file:${userDataPath}/refly.db`;
  process.env.VECTOR_STORE_BACKEND = 'lancedb';
  process.env.LANCEDB_URI = path.join(userDataPath, 'lancedb');
  process.env.FULLTEXT_SEARCH_BACKEND = 'prisma';
  process.env.OBJECT_STORAGE_BACKEND = 'fs';
  process.env.OBJECT_STORAGE_FS_ROOT = path.join(userDataPath, 'objectStorage');

  preparePrismaEnv();
}
