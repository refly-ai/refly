import './register-aliases';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Logger } from 'nestjs-pino';

import { AppModule } from './modules/app.module';
import { ConfigService } from '@nestjs/config';

import tracer from './tracer';
import { setTraceID } from './utils/middleware/set-trace-id';
import { GlobalExceptionFilter } from './utils/filters/global-exception.filter';
import { CustomWsAdapter } from './utils/adapters/ws-adapter';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  profilesSampleRate: 1.0,
  release: `refly-api@${process.env.APP_VERSION ?? 'unknown'}-${process.env.COMMIT_HASH ?? 'unknown'}`,
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: false,
  });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  process.on('uncaughtException', (err) => {
    Sentry.captureException(err);
  });

  process.on('unhandledRejection', (err) => {
    Sentry.captureException(err);
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
  app.useGlobalFilters(new GlobalExceptionFilter(configService));

  tracer.start();

  const port = configService.get('port');
  await app.listen(port);
  
  // Log application version and commit hash when API starts
  logger.log(`API server running on port ${port}`);
  logger.log(`Version: ${process.env.APP_VERSION ?? 'unknown'}`);
  logger.log(`Commit: ${process.env.COMMIT_HASH ?? 'unknown'}`);
}
bootstrap();
