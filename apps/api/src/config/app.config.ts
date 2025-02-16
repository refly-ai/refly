export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export default () => ({
  port: Number.parseInt(process.env.PORT) || 5800,
  wsPort: Number.parseInt(process.env.WS_PORT) || 5801,
  endpoint: process.env.ENDPOINT || 'http://localhost:5800',
  origin: process.env.ORIGIN || 'http://localhost:5700',
  staticEndpoint: process.env.STATIC_ENDPOINT || 'http://localhost:5800/v1/misc',
  image: {
    maxArea: Number.parseInt(process.env.IMAGE_MAX_AREA) || 600 * 600,
    payloadMode: process.env.IMAGE_PAYLOAD_MODE || 'base64', // 'url' or 'base64'
    presignExpiry: Number.parseInt(process.env.IMAGE_PRESIGN_EXPIRY) || 15 * 60, // 15 minutes
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
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
  vectorStore: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: Number.parseInt(process.env.QDRANT_PORT) || 6333,
    apiKey: process.env.QDRANT_API_KEY,
    vectorDim: Number.parseInt(process.env.REFLY_VEC_DIM) || 768,
  },
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
  },
  auth: {
    skipVerification: process.env.AUTH_SKIP_VERIFICATION === 'true' || false,
    cookieDomain: process.env.REFLY_COOKIE_DOMAIN || 'localhost',
    redirectUrl: process.env.LOGIN_REDIRECT_URL,
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
      resendApiKey: process.env.RESEND_API_KEY,
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
  embeddings: {
    provider: process.env.EMBEDDINGS_PROVIDER || 'jina',
    modelName: process.env.EMBEDDINGS_MODEL_NAME || 'jina-embeddings-v3',
    dimensions: Number.parseInt(process.env.EMBEDDINGS_DIMENSIONS) || 768,
    batchSize: Number.parseInt(process.env.EMBEDDINGS_BATCH_SIZE) || 512,
  },
  reranker: {
    topN: Number.parseInt(process.env.RERANKER_TOP_N) || 10,
    model: process.env.RERANKER_MODEL || 'jina-reranker-v2-base-multilingual',
    relevanceThreshold: Number.parseFloat(process.env.RERANKER_RELEVANCE_THRESHOLD) || 0.5,
  },
  skill: {
    defaultModel: process.env.REFLY_DEFAULT_MODEL || 'openai/gpt-4o-mini',
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
      file: Number.parseInt(process.env.QUOTA_STORAGE_FILE) || 10000,
      object: Number.parseInt(process.env.QUOTA_STORAGE_OBJECT) || 1000000000,
      vector: Number.parseInt(process.env.QUOTA_STORAGE_VECTOR) || 1000000000,
    },
  },
  credentials: {
    openai: process.env.OPENAI_API_KEY,
    jina: process.env.JINA_API_KEY,
    fireworks: process.env.FIREWORKS_API_KEY,
    serper: process.env.SERPER_API_KEY,
    marker: process.env.MARKER_API_KEY,
  },
});
