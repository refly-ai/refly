#!/usr/bin/env node
import { Client as MinioClient } from 'minio';

async function uploadState(sourceFile, targetPath) {
  const minioClient = new MinioClient({
    endPoint: process.env.MINIO_EXTERNAL_ENDPOINT,
    port: Number.parseInt(process.env.MINIO_EXTERNAL_PORT || '443'),
    useSSL: process.env.MINIO_EXTERNAL_USE_SSL === 'true',
    accessKey: process.env.MINIO_EXTERNAL_ACCESS_KEY,
    secretKey: process.env.MINIO_EXTERNAL_SECRET_KEY,
  });

  const metaData = {
    'Content-Type': 'application/json',
  };
  await minioClient.fPutObject(process.env.MINIO_EXTERNAL_BUCKET, targetPath, sourceFile, metaData);
}

async function main() {
  // upload mcp catalog
  await uploadState('config/mcp-catalog.json', 'mcp-config/mcp-catalog.json');
}

main();
