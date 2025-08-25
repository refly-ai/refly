import { ExecutionContext, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { SkipThrottle, ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import api from '@opentelemetry/api';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RAGModule } from './rag/rag.module';

import configuration from './config/app.config';
import { AppController } from './app.controller';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SkillModule } from './skill/skill.module';
import { PilotModule } from './pilot/pilot.module';
import { SearchModule } from './search/search.module';
import { LabelModule } from './label/label.module';
import { EventModule } from './event/event.module';
import { MiscModule } from './misc/misc.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { StripeModule } from '@golevelup/nestjs-stripe';
import { CanvasModule } from './canvas/canvas.module';
import { CollabModule } from './collab/collab.module';
import { ActionModule } from './action/action.module';
import { ShareModule } from './share/share.module';
import { ProviderModule } from './provider/provider.module';
import { TemplateModule } from './template/template.module';
import { CodeArtifactModule } from './code-artifact/code-artifact.module';
import { PagesModule } from './pages/pages.module';
import { ProjectModule } from './project/project.module';
import { McpServerModule } from './mcp-server/mcp-server.module';
import { InternalMcpModule } from './internal-mcp/internal-mcp.module';
import { MediaGeneratorModule } from './media-generator/media-generator.module';
import { CreditModule } from './credit/credit.module';
import { WorkflowModule } from './workflow/workflow.module';

import { isDesktop } from '../utils/runtime';

class CustomThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const contextType = context.getType<'http' | 'stripe_webhook'>();

    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    // Skip throttling for Stripe webhook endpoint
    if (contextType === 'stripe_webhook') {
      return true;
    }

    return false;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
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
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        formatters: {
          level: (level) => ({ level }),
        },
      },
    }),
    AuthModule,
    UserModule,
    RAGModule,
    KnowledgeModule,
    SkillModule,
    PilotModule,
    SearchModule,
    LabelModule,
    EventModule,
    MiscModule,
    SubscriptionModule,
    CanvasModule,
    CollabModule,
    ActionModule,
    ShareModule,
    ProviderModule,
    TemplateModule,
    CodeArtifactModule,
    PagesModule,
    ProjectModule,
    McpServerModule,
    InternalMcpModule,
    MediaGeneratorModule,
    CreditModule,
    WorkflowModule,
    ...(isDesktop()
      ? []
      : [
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
          ThrottlerModule.forRootAsync({
            useFactory: async () => ({
              throttlers: [
                {
                  name: 'default',
                  ttl: seconds(1),
                  limit: 50,
                },
              ],
              getTracker: (req) => (req.ips?.length ? req.ips[0] : req.ip),
            }),
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
                decorators: [SkipThrottle()],
                requestBodyProperty: 'rawBody',
              },
            }),
            inject: [ConfigService],
          }),
        ]),
  ],
  controllers: [AppController],
  providers: isDesktop()
    ? []
    : [
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
      ],
})
export class AppModule {}
