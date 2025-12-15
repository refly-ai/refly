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
import { NotificationModule } from './notification/notification.module';

import configuration from './config/app.config';
import { AppController } from './app.controller';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SkillModule } from './skill/skill.module';
import { PilotModule } from './pilot/pilot.module';
import { CopilotModule } from './copilot/copilot.module';
import { CopilotAutogenModule } from './copilot-autogen/copilot-autogen.module';
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
import { WorkflowAppModule } from './workflow-app/workflow-app.module';
import { ToolModule } from './tool/tool.module';
import { VariableExtractionModule } from './variable-extraction/variable-extraction.module';
import { InvitationModule } from './invitation/invitation.module';
import { DriveModule } from './drive/drive.module';
import { FormModule } from './form/form.module';
import { VoucherModule } from './voucher/voucher.module';
import { CommonModule } from './common/common.module';
import { RedisService } from './common/redis.service';

import { isDesktop } from '../utils/runtime';
import { initTracer } from '../tracer';

// Initialize OpenTelemetry tracing
// Tracer handles its own configuration via environment variables:
// - OTLP_TRACES_ENDPOINT: Tempo/Grafana (full observability)
// - LANGFUSE_BASE_URL + LANGFUSE_*: Langfuse (LLM spans only)
initTracer();

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
        // Inject traceId into every log for Loki → Tempo correlation
        mixin: () => {
          const traceId = api.trace.getSpan(api.context.active())?.spanContext()?.traceId;
          return traceId ? { traceId } : {};
        },
        // Development: pino-pretty for colored output
        // Production or LOG_JSON=true: JSON to stdout (collected by k8s log aggregator / Alloy)
        transport:
          process.env.NODE_ENV === 'production' || process.env.LOG_JSON === 'true'
            ? undefined
            : { target: 'pino-pretty' },
        formatters: {
          level: (level) => ({ level }),
        },
      },
    }),
    AuthModule,
    UserModule,
    RAGModule,
    NotificationModule,
    KnowledgeModule,
    SkillModule,
    PilotModule,
    CopilotModule,
    CopilotAutogenModule,
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
    ToolModule,
    TemplateModule,
    CodeArtifactModule,
    PagesModule,
    ProjectModule,
    McpServerModule,
    InternalMcpModule,
    MediaGeneratorModule,
    CreditModule,
    InvitationModule,
    WorkflowModule,
    WorkflowAppModule,
    VariableExtractionModule,
    DriveModule,
    FormModule,
    VoucherModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.forRootAsync({
            imports: [CommonModule],
            useFactory: (redisService: RedisService) => {
              return { connection: redisService.getClient() };
            },
            inject: [RedisService],
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
