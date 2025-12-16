import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { setMaxListeners } from 'node:events';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Increase global AbortSignal listener limit to avoid warnings from concurrent LLM requests
// OpenAI SDK adds abort listeners per request; default limit of 10 is too low for parallel calls
setMaxListeners(50);

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Logger } from 'nestjs-pino';

import { AppModule } from './modules/app.module';
import { ConfigService } from '@nestjs/config';

import { setTraceID } from './utils/middleware/set-trace-id';
import { HttpRouteInterceptor } from './utils/interceptors/http-route.interceptor';
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
    bufferLogs: true,
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

  app.enableCors({
    origin: configService.get('origin').split(','),
    credentials: true,
  });
  app.use(cookieParser());

  app.useWebSocketAdapter(new CustomWsAdapter(app, configService.get<number>('wsPort')));
  app.useGlobalInterceptors(new HttpRouteInterceptor());
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
