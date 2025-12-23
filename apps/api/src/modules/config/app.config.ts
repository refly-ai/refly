import path from 'node:path';

export default () => ({
  port: Number.parseInt(process.env.PORT) || 5800,
  wsPort: Number.parseInt(process.env.WS_PORT) || 5801,
  origin: process.env.ORIGIN || 'http://localhost:5700',
  endpoint: process.env.ENDPOINT || 'http://localhost:5800',
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
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' || false,
  },
  drive: {
    storageKeyPrefix: process.env.DRIVE_STORAGE_KEY_PREFIX || 'drive',
    payloadMode: process.env.DRIVE_PAYLOAD_MODE || 'url', // 'url' or 'base64'
    presignExpiry: Number.parseInt(process.env.DRIVE_PRESIGN_EXPIRY) || 15 * 60, // 15 minutes
    archiveConcurrencyLimit: Number.parseInt(process.env.DRIVE_ARCHIVE_CONCURRENCY_LIMIT) || 10, // Maximum concurrent file archive operations
    publicEndpoint:
      process.env.DRIVE_PUBLIC_ENDPOINT || 'http://localhost:5800/v1/drive/file/public',
    maxContentTokens: Number.parseInt(process.env.DRIVE_MAX_CONTENT_TOKENS) || 25000, // Maximum tokens in returned content (aligned with Claude Code's limit)
    maxParseFileSizeKB: Number.parseInt(process.env.DRIVE_MAX_PARSE_FILE_SIZE_KB) || 512, // Maximum file size (KB) for direct parsing, larger files should use execute_code
  },
  session: {
    secret: process.env.SESSION_SECRET || 'refly-session-secret-key-change-in-production',
    maxAge: Number.parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours in milliseconds
    cookieName: process.env.SESSION_COOKIE_NAME || 'refly.sid',
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
        region: process.env.MINIO_INTERNAL_REGION || 'us-east-1',
      },
      external: {
        endPoint: process.env.MINIO_EXTERNAL_ENDPOINT || 'localhost',
        port: Number.parseInt(process.env.MINIO_EXTERNAL_PORT) || 9000,
        useSSL: process.env.MINIO_EXTERNAL_USE_SSL === 'true' || false,
        accessKey: process.env.MINIO_EXTERNAL_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_EXTERNAL_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_EXTERNAL_BUCKET || 'refly-weblink',
        region: process.env.MINIO_EXTERNAL_REGION || 'us-east-1',
      },
    },
  },
  vectorStore: {
    backend: process.env.VECTOR_STORE_BACKEND || 'qdrant', // 'qdrant' or 'lancedb'
    qdrant: {
      host: process.env.QDRANT_HOST || 'localhost',
      port: Number.parseInt(process.env.QDRANT_PORT) || 6333,
      apiKey: process.env.QDRANT_API_KEY,
    },
    lancedb: {
      uri: process.env.LANCEDB_URI || './data/lancedb',
    },
  },
  fulltextSearch: {
    backend: process.env.FULLTEXT_SEARCH_BACKEND || 'prisma',
    elasticsearch: {
      url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
    },
  },
  email: {
    sender: process.env.EMAIL_SENDER || 'Refly <notifications@refly.ai>',
    payloadMode: process.env.EMAIL_PAYLOAD_MODE || 'base64', // 'url' or 'base64'
    resendApiKey: process.env.RESEND_API_KEY || 're_123',
    maxRetries: Number.parseInt(process.env.EMAIL_MAX_RETRIES) || 3,
    baseDelayMs: Number.parseInt(process.env.EMAIL_BASE_DELAY_MS) || 500,
    minTimeBetweenEmailsMs: Number.parseInt(process.env.EMAIL_MIN_TIME_BETWEEN_MS) || 500, // 2 QPS = 500ms between emails
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
      expiresIn: process.env.JWT_EXPIRATION_TIME || '1d',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION_TIME || '14d',
    },
    collab: {
      tokenExpiry: process.env.COLLAB_TOKEN_EXPIRY || '1h',
    },
    email: {
      enabled: process.env.EMAIL_AUTH_ENABLED === 'true' || true,
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
    twitter: {
      enabled: process.env.TWITTER_AUTH_ENABLED === 'true' || false,
      clientId: process.env.TWITTER_CLIENT_ID || 'test',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || 'test',
      callbackUrl: process.env.TWITTER_CALLBACK_URL || 'test',
      consumerKey: process.env.TWITTER_CONSUMER_KEY || 'test',
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET || 'test',
      bearerToken: process.env.TWITTER_BEARER_TOKEN || 'test',
    },
    notion: {
      enabled: process.env.NOTION_AUTH_ENABLED === 'true' || false,
      clientId: process.env.NOTION_CLIENT_ID || 'test',
      clientSecret: process.env.NOTION_CLIENT_SECRET || 'test',
      callbackUrl: process.env.NOTION_CALLBACK_URL || 'test',
      authorizationURL: process.env.NOTION_AUTHORIZATION_URL || 'test',
    },
    invitation: {
      requireInvitationCode: process.env.AUTH_REQUIRE_INVITATION_CODE === 'true' || false,
      inviterCreditAmount: Number.parseInt(process.env.INVITATION_INVITER_CREDIT_AMOUNT) || 500,
      inviteeCreditAmount: Number.parseInt(process.env.INVITATION_INVITEE_CREDIT_AMOUNT) || 500,
      inviterCreditExpiresInMonths:
        Number.parseInt(process.env.INVITATION_INVITER_CREDIT_EXPIRES_IN_MONTHS) || 3,
      inviteeCreditExpiresInMonths:
        Number.parseInt(process.env.INVITATION_INVITEE_CREDIT_EXPIRES_IN_MONTHS) || 3,
    },
    registration: {
      bonusCreditAmount: Number.parseInt(process.env.REGISTRATION_BONUS_CREDIT_AMOUNT) || 3000,
      bonusCreditExpiresInMonths:
        Number.parseInt(process.env.REGISTRATION_BONUS_CREDIT_EXPIRES_IN_MONTHS) || 3,
    },
  },
  tools: {
    supportedToolsets: process.env.SUPPORTED_TOOLSETS || '', // comma separated list of toolset keys
    google: {
      clientId: process.env.GOOGLE_TOOLS_CLIENT_ID,
      clientSecret: process.env.GOOGLE_TOOLS_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_TOOLS_CALLBACK_URL,
    },
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  skill: {
    streamIdleTimeout: Number.parseInt(process.env.SKILL_STREAM_IDLE_TIMEOUT) || 0,
    streamIdleCheckInterval:
      Number.parseInt(process.env.SKILL_STREAM_IDLE_CHECK_INTERVAL) || 1000 * 3, // 3 seconds
    stuckCheckInterval: Number.parseInt(process.env.SKILL_STUCK_CHECK_INTERVAL) || 0,
    stuckTimeoutThreshold: Number.parseInt(process.env.SKILL_STUCK_TIMEOUT_THRESHOLD) || 0,
  },
  provider: {
    defaultMode: process.env.PROVIDER_DEFAULT_MODE || 'custom',
  },
  defaultModel: {
    chat: process.env.DEFAULT_MODEL_CHAT,
    copilot: process.env.DEFAULT_MODEL_COPILOT || process.env.DEFAULT_MODEL_CHAT,
    agent: process.env.DEFAULT_MODEL_AGENT,
    queryAnalysis: process.env.DEFAULT_MODEL_QUERY_ANALYSIS,
    titleGeneration: process.env.DEFAULT_MODEL_TITLE_GENERATION,
    image: process.env.DEFAULT_MODEL_IMAGE,
    video: process.env.DEFAULT_MODEL_VIDEO,
    audio: process.env.DEFAULT_MODEL_AUDIO,
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
    baseUrl: process.env.LANGFUSE_BASE_URL,
  },
  composio: {
    apiKey: process.env.COMPOSIO_API_KEY,
  },
  credit: {
    executionCreditMarkup: Number(process.env.CREDIT_EXECUTION_CREDIT_MARKUP) || 1.2,
    canvasCreditCommissionRate: Number(process.env.CREDIT_CANVAS_CREDIT_COMMISSION_RATE) || 0.2,
    commissionCreditExpiresIn: Number(process.env.CREDIT_COMMISSION_CREDIT_EXPIRES_IN) || 6,
    creditPackExpiresInDays: Number(process.env.CREDIT_PACK_EXPIRES_IN_DAYS) || 90,
    firstSubscriptionGiftCreditAmount:
      Number(process.env.CREDIT_FIRST_SUBSCRIPTION_GIFT_CREDIT_AMOUNT) || 2000,
    firstSubscriptionGiftCreditExpiresInMonths:
      Number(process.env.CREDIT_FIRST_SUBSCRIPTION_GIFT_CREDIT_EXPIRES_IN_MONTHS) || 1,
  },
  voucher: {
    // Expiration time in minutes (default: 7 days = 10080 minutes)
    // For testing, use smaller values like 7 (7 minutes)
    expirationMinutes: Number(process.env.VOUCHER_EXPIRATION_MINUTES) || 10080,
  },
  audio: {
    fish: {
      apiKey: process.env.FISH_AUDIO_API_KEY,
    },
  },

  video: {
    heygen: {
      apiKey: process.env.HEYGEN_API_KEY,
    },
  },

  sandbox: {
    scalebox: {
      apiKey: process.env.SCALEBOX_API_KEY,
      // Wrapper
      wrapperType: process.env.SCALEBOX_WRAPPER_TYPE, // 'executor' | 'interpreter'
      templateName: process.env.SCALEBOX_TEMPLATE_NAME,
      codeSizeThreshold: process.env.SCALEBOX_CODE_SIZE_THRESHOLD,
      // Sandbox
      sandboxTimeoutMs: process.env.SCALEBOX_SANDBOX_TIMEOUT_MS,
      // Pool
      maxSandboxes: process.env.SCALEBOX_MAX_SANDBOXES,
      maxQueueSize: process.env.SCALEBOX_MAX_QUEUE_SIZE,
      autoPauseDelayMs: process.env.SCALEBOX_AUTO_PAUSE_DELAY_MS,
      // Lock
      runCodeTimeoutSec: process.env.SCALEBOX_RUN_CODE_TIMEOUT_SEC,
      lockWaitTimeoutSec: process.env.SCALEBOX_LOCK_WAIT_TIMEOUT_SEC,
      lockPollIntervalMs: process.env.SCALEBOX_LOCK_POLL_INTERVAL_MS,
      lockInitialTtlSec: process.env.SCALEBOX_LOCK_INITIAL_TTL_SEC,
      lockRenewalIntervalMs: process.env.SCALEBOX_LOCK_RENEWAL_INTERVAL_MS,
      // Executor limits
      limits: {
        maxFileSize: process.env.SCALEBOX_LIMITS_MAX_FILE_SIZE,
        maxTotalWrite: process.env.SCALEBOX_LIMITS_MAX_TOTAL_WRITE,
        maxFiles: process.env.SCALEBOX_LIMITS_MAX_FILES,
        maxProcesses: process.env.SCALEBOX_LIMITS_MAX_PROCESSES,
      },
    },
  },
});
