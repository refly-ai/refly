import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import tracer from './tracer';
import { setTraceID } from './middleware/set-trace-id';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  profilesSampleRate: 1.0,
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = app.get(Logger);

  process.on('uncaughtException', (err) => {
    Sentry.captureException(err);
  });

  process.on('unhandledRejection', (err) => {
    Sentry.captureException(err);
  });

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  app.useLogger(logger);
  app.use(setTraceID);
  app.use(helmet());
  app.enableCors();
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.setGlobalPrefix('/v1', { exclude: ['/'] });

  const config = new DocumentBuilder()
    .setTitle('Refly Backend API')
    .setDescription('The Refly API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  tracer.start();
  const configService = app.get(ConfigService);
  await app.listen(configService.get('port'));
}
bootstrap();
