import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import api from '@opentelemetry/api';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RAGModule } from './rag/rag.module';

import configuration from './config/app.config';
import { AppController } from './app.controller';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SkillModule } from './skill/skill.module';
import { SearchModule } from './search/search.module';
import { LabelModule } from './label/label.module';
import { EventModule } from './event/event.module';
import { MiscModule } from './misc/misc.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { StripeModule } from '@golevelup/nestjs-stripe';
import { ShareModule } from './share/share.module';
import { CanvasModule } from './canvas/canvas.module';
import { CollabModule } from './collab/collab.module';
import { ActionModule } from './action/action.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      cache: true,
      expandVariables: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: {
          paths: ['pid', 'hostname', 'req.headers'],
          remove: true,
        },
        autoLogging: false,
        genReqId: () => api.trace.getSpan(api.context.active())?.spanContext()?.traceId,
        customSuccessObject: (req) => ({
          env: process.env.NODE_ENV,
          uid: (req as any).user?.uid || 'anonymous',
        }),
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password') || undefined,
        },
      }),
      inject: [ConfigService],
    }),
    StripeModule.forRootAsync(StripeModule, {
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        apiKey: configService.get('stripe.apiKey'),
        webhookConfig: {
          stripeSecrets: {
            account: configService.get('stripe.webhookSecret.account'),
            accountTest: configService.get('stripe.webhookSecret.accountTest'),
          },
          requestBodyProperty: 'rawBody',
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    RAGModule,
    KnowledgeModule,
    SkillModule,
    SearchModule,
    LabelModule,
    EventModule,
    MiscModule,
    SubscriptionModule,
    ShareModule,
    CanvasModule,
    CollabModule,
    ActionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
