import path from 'node:path';
import getPort from 'get-port';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { app } from 'electron';
import { AppModule } from '@/modules/app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '@/utils/filters/global-exception.filter';
import { setTraceID } from '@/utils/middleware/set-trace-id';
import { CustomWsAdapter } from '@/utils/adapters/ws-adapter';

let nestApp: NestExpressApplication | null = null;

export const startApiServer = async () => {
  process.env.DATABASE_URL = `file:${app.getPath('userData')}/refly.db`;
  process.env.FULLTEXT_SEARCH_BACKEND = 'prisma';
  process.env.OBJECT_STORAGE_BACKEND = 'fs';
  process.env.OBJECT_STORAGE_FS_ROOT = path.join(app.getPath('userData'), 'objectStorage');

  nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: false,
  });

  nestApp.useLogger(nestApp.get(Logger));
  const configService = nestApp.get(ConfigService);
  configService.set('mode', 'desktop');

  nestApp.useBodyParser('json', { limit: '10mb' });
  nestApp.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  nestApp.useStaticAssets(path.join(__dirname, '..', 'public'));
  nestApp.setBaseViewsDir(path.join(__dirname, '..', 'views'));
  nestApp.setViewEngine('hbs');
  nestApp.set('trust proxy', true);

  nestApp.use(setTraceID);
  nestApp.use(helmet());
  nestApp.enableCors();
  nestApp.use(cookieParser());
  nestApp.useGlobalFilters(new GlobalExceptionFilter(configService));

  const wsPort = await getPort();
  nestApp.useWebSocketAdapter(new CustomWsAdapter(app, wsPort));
  process.env.RF_COLLAB_URL = `ws://localhost:${wsPort}`;
  console.log(`Collab server running at ${process.env.RF_COLLAB_URL}`);

  // Use a free port for internal API server
  const port = await getPort();
  nestApp.listen(port);
  process.env.RF_API_BASE_URL = `http://localhost:${port}`;

  console.log(`API server running at ${process.env.RF_API_BASE_URL}`);

  // Set the static endpoints for the desktop app
  const publicStaticEndpoint = `http://localhost:${port}/v1/misc/public`;
  const privateStaticEndpoint = `http://localhost:${port}/v1/misc`;
  process.env.RF_PUBLIC_STATIC_ENDPOINT = publicStaticEndpoint;
  process.env.RF_PRIVATE_STATIC_ENDPOINT = privateStaticEndpoint;

  configService.set('static.public.endpoint', publicStaticEndpoint);
  configService.set('static.private.endpoint', privateStaticEndpoint);

  return nestApp;
};

export const shutdownApiServer = async () => {
  if (nestApp) {
    await nestApp.close();
  }
};
