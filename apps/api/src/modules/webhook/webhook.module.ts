import { Module, forwardRef } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { WebhookManagementController } from './webhook-management.controller';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { DebounceGuard } from './guards/debounce.guard';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { WorkflowModule } from '../workflow/workflow.module';

/**
 * Webhook Module
 * Provides webhook trigger endpoints (no authentication required)
 * Webhook ID acts as the secret for triggering workflows
 */
@Module({
  imports: [CommonModule, forwardRef(() => AuthModule), forwardRef(() => WorkflowModule)],
  controllers: [WebhookController, WebhookManagementController],
  providers: [WebhookService, WebhookAuthGuard, RateLimitGuard, DebounceGuard],
  exports: [WebhookService],
})
export class WebhookModule {}
