import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import session, { SessionOptions } from 'express-session';
import RedisStore from 'connect-redis';

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Logger } from 'nestjs-pino';

import { AppModule } from './modules/app.module';
import { ConfigService } from '@nestjs/config';
import { isDesktop } from './utils/runtime';

import { setTraceID } from './utils/middleware/set-trace-id';
import { GlobalExceptionFilter } from './utils/filters/global-exception.filter';
import { CustomWsAdapter } from './utils/adapters/ws-adapter';
import { setupStatsig } from '@refly/telemetry-node';
import { migrateDbSchema } from './utils/prisma';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  profilesSampleRate: 1.0,
});

async function bootstrap() {
  // Auto migrate db schema if the environment variable is set
  if (process.env.AUTO_MIGRATE_DB_SCHEMA) {
    migrateDbSchema();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: false,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);

  process.on('uncaughtException', (err) => {
    const stack = (err as Error)?.stack ?? String(err);
    logger.error(`main process uncaughtException: ${stack}`);
    Sentry.captureException(err);
    // Do not exit; keep the process alive. Investigate recurring errors via Sentry logs.
  });

  process.on('unhandledRejection', (err) => {
    const message = (err as Error)?.stack ?? String(err);
    logger.error(`main process unhandledRejection: ${message}`);
    Sentry.captureException(err as any);
    // Do not exit; keep the process alive. Investigate recurring errors via Sentry logs.
  });

  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.set('trust proxy', true);

  app.use(setTraceID);
  app.use(helmet());

  // Session middleware for OAuth state management with Redis storage
  const sessionConfig: SessionOptions = {
    secret: configService.get('session.secret', 'your-super-secret-key'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  // Create Redis client directly for session storage
  if (!isDesktop()) {
    try {
      const Redis = require('ioredis');
      const redisClient = new Redis({
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        username: configService.get('redis.username'),
        password: configService.get('redis.password'),
      });

      logger.log('Configuring session with Redis storage');

      redisClient.on('error', (err) => {
        logger.error(`Session Redis client error: ${err.message}`, err.stack);
      });

      sessionConfig.store = new RedisStore({
        client: redisClient,
        prefix: 'session:',
        ttl: 24 * 60 * 60, // 24 hours in seconds
      });
    } catch (error) {
      logger.error('Failed to create Redis client for session storage, using memory store', error);
    }
  } else {
    logger.warn('Desktop mode: using default memory store for sessions');
  }

  app.use(session(sessionConfig));

  app.enableCors({
    origin: configService.get('origin').split(','),
    credentials: true,
  });
  app.use(cookieParser());

  app.useWebSocketAdapter(new CustomWsAdapter(app, configService.get<number>('wsPort')));
  app.useGlobalFilters(new GlobalExceptionFilter(configService));

  try {
    await setupStatsig();
  } catch (err) {
    // Continue boot-strapping even if telemetry is unavailable
    console.warn('Statsig init failed – proceeding without telemetry', err);
  }

  await app.listen(configService.get('port'));
}
bootstrap();
