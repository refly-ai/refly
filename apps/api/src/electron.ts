import path from 'node:path';
import getPort from 'get-port';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './modules/app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './utils/filters/global-exception.filter';
import { setTraceID } from './utils/middleware/set-trace-id';
import { CustomWsAdapter } from './utils/adapters/ws-adapter';
import { LoggerService } from '@nestjs/common';

let nestApp: NestExpressApplication | null = null;

export const startApiServerForElectron = async (logger: LoggerService) => {
  logger.log(`Creating NestJS application, mode: ${process.env.MODE}`);
  nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: false,
  });

  nestApp.useLogger(logger);
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
  nestApp.useWebSocketAdapter(new CustomWsAdapter(nestApp, wsPort));
  process.env.RF_COLLAB_URL = `ws://localhost:${wsPort}`;
  logger.log(`Collab server running at ${process.env.RF_COLLAB_URL}`);

  // Use a free port for internal API server
  const port = await getPort();
  await nestApp.listen(port);
  process.env.RF_API_BASE_URL = `http://localhost:${port}`;

  logger.log(`API server running at ${process.env.RF_API_BASE_URL}`);

  // Set the static endpoints for the desktop app
  const publicStaticEndpoint = `http://localhost:${port}/v1/misc/public`;
  const privateStaticEndpoint = `http://localhost:${port}/v1/misc`;
  const drivePublicEndpoint = `http://localhost:${port}/v1/drive/file/public`;
  process.env.RF_PUBLIC_STATIC_ENDPOINT = publicStaticEndpoint;
  process.env.RF_PRIVATE_STATIC_ENDPOINT = privateStaticEndpoint;
  process.env.RF_DRIVE_PUBLIC_ENDPOINT = drivePublicEndpoint;

  configService.set('static.public.endpoint', publicStaticEndpoint);
  configService.set('static.private.endpoint', privateStaticEndpoint);
  configService.set('drive.publicEndpoint', drivePublicEndpoint);

  logger.log('API server configuration completed', {
    publicStaticEndpoint,
    privateStaticEndpoint,
    drivePublicEndpoint,
    collabUrl: process.env.RF_COLLAB_URL,
    apiBaseUrl: process.env.RF_API_BASE_URL,
  });

  return nestApp;
};

export const shutdownApiServer = async (logger: LoggerService) => {
  if (nestApp) {
    logger.log('Shutting down API server');
    await nestApp.close();
    logger.log('API server shut down successfully');
  }
};
