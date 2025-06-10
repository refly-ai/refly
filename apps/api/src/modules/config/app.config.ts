import path from 'node:path';

export enum AppMode {
  Server = 'server',
  Desktop = 'desktop',
}

export default () => ({
  mode: process.env.MODE || AppMode.Server,
  port: Number.parseInt(process.env.PORT) || 5800,
  wsPort: Number.parseInt(process.env.WS_PORT) || 5801,
  origin: process.env.ORIGIN || 'http://localhost:5700',
  static: {
    public: {
      endpoint: process.env.STATIC_PUBLIC_ENDPOINT || 'http://localhost:5800/v1/misc/public',
    },
    private: {
      endpoint: process.env.STATIC_PRIVATE_ENDPOINT || 'http://localhost:5800/v1/misc',
    },
  },
  local: {
    uid: process.env.LOCAL_UID || 'u-local',
  },
  image: {
    maxArea: Number.parseInt(process.env.IMAGE_MAX_AREA) || 600 * 600,
    payloadMode: process.env.IMAGE_PAYLOAD_MODE || 'base64', // 'url' or 'base64'
    presignExpiry: Number.parseInt(process.env.IMAGE_PRESIGN_EXPIRY) || 15 * 60, // 15 minutes
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  },
  objectStorage: {
    reclaimPolicy: process.env.OBJECT_STORAGE_RECLAIM_POLICY || 'retain', // 'retain' or 'delete'
    backend: process.env.OBJECT_STORAGE_BACKEND || 'minio',
    fs: {
      root: process.env.OBJECT_STORAGE_FS_ROOT || path.join(process.cwd(), 'storage'),
    },
    minio: {
      internal: {
        endPoint: process.env.MINIO_INTERNAL_ENDPOINT || 'localhost',
        port: Number.parseInt(process.env.MINIO_INTERNAL_PORT) || 9000,
        useSSL: process.env.MINIO_INTERNAL_USE_SSL === 'true' || false,
        accessKey: process.env.MINIO_INTERNAL_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_INTERNAL_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_INTERNAL_BUCKET || 'refly-weblink',
      },
      external: {
        endPoint: process.env.MINIO_EXTERNAL_ENDPOINT || 'localhost',
        port: Number.parseInt(process.env.MINIO_EXTERNAL_PORT) || 9000,
        useSSL: process.env.MINIO_EXTERNAL_USE_SSL === 'true' || false,
        accessKey: process.env.MINIO_EXTERNAL_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_EXTERNAL_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_EXTERNAL_BUCKET || 'refly-weblink',
      },
    },
  },
  vectorStore: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: Number.parseInt(process.env.QDRANT_PORT) || 6333,
    apiKey: process.env.QDRANT_API_KEY,
  },
  fulltextSearch: {
    backend: process.env.FULLTEXT_SEARCH_BACKEND || 'prisma',
    elasticsearch: {
      url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
    },
  },
  auth: {
    skipVerification: process.env.AUTH_SKIP_VERIFICATION === 'true' || false,
    redirectUrl: process.env.LOGIN_REDIRECT_URL,
    cookie: {
      domain: process.env.REFLY_COOKIE_DOMAIN,
      secure: process.env.REFLY_COOKIE_SECURE,
      sameSite: process.env.REFLY_COOKIE_SAME_SITE,
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'test',
      expiresIn: process.env.JWT_EXPIRATION_TIME || '1h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION_TIME || '7d',
    },
    collab: {
      tokenExpiry: process.env.COLLAB_TOKEN_EXPIRY || '1h',
    },
    email: {
      enabled: process.env.EMAIL_AUTH_ENABLED === 'true' || true,
      sender: process.env.EMAIL_SENDER || 'Refly <notifications@refly.ai>',
      resendApiKey: process.env.RESEND_API_KEY || 're_123',
    },
    github: {
      enabled: process.env.GITHUB_AUTH_ENABLED === 'true' || false,
      clientId: process.env.GITHUB_CLIENT_ID || 'test',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'test',
      callbackUrl: process.env.GITHUB_CALLBACK_URL || 'test',
    },
    google: {
      enabled: process.env.GOOGLE_AUTH_ENABLED === 'true' || false,
      clientId: process.env.GOOGLE_CLIENT_ID || 'test',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'test',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'test',
    },
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  skill: {
    idleTimeout: Number.parseInt(process.env.SKILL_IDLE_TIMEOUT) || 1000 * 60, // 1 minute
    executionTimeout: Number.parseInt(process.env.SKILL_EXECUTION_TIMEOUT) || 1000 * 60 * 3, // 3 minutes
  },
  stripe: {
    apiKey: process.env.STRIPE_API_KEY,
    webhookSecret: {
      account: process.env.STRIPE_ACCOUNT_WEBHOOK_SECRET || 'test',
      accountTest: process.env.STRIPE_ACCOUNT_TEST_WEBHOOK_SECRET || 'test',
    },
    sessionSuccessUrl: process.env.STRIPE_SESSION_SUCCESS_URL,
    sessionCancelUrl: process.env.STRIPE_SESSION_CANCEL_URL,
    portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL,
  },
  quota: {
    token: {
      t1: Number.parseInt(process.env.QUOTA_T1_TOKEN) || -1,
      t2: Number.parseInt(process.env.QUOTA_T2_TOKEN) || -1,
    },
    request: {
      t1: Number.parseInt(process.env.QUOTA_T1_REQUEST) || -1,
      t2: Number.parseInt(process.env.QUOTA_T2_REQUEST) || -1,
    },
    storage: {
      file: Number.parseInt(process.env.QUOTA_STORAGE_FILE) || -1,
      object: Number.parseInt(process.env.QUOTA_STORAGE_OBJECT) || -1,
      vector: Number.parseInt(process.env.QUOTA_STORAGE_VECTOR) || -1,
    },
    fileParse: {
      page: Number.parseInt(process.env.QUOTA_FILE_PARSE_PAGE) || -1,
    },
  },
  langfuse: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    host: process.env.LANGFUSE_HOST,
  },
});
