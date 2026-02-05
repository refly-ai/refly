import { Module } from '@nestjs/common';
import { OpenapiService } from './openapi.service';
import { FileUploadService } from './file-upload.service';
import { WorkflowApiController } from './controllers/workflow-api.controller';
import { FileUploadController } from './controllers/file-upload.controller';
import { OpenapiConfigController } from './controllers/openapi-config.controller';
import { OpenapiCopilotController } from './controllers/openapi-copilot.controller';
import { OpenapiWorkflowsController } from './controllers/openapi-workflows.controller';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { DebounceGuard } from './guards/debounce.guard';
import { ApiCallTrackingInterceptor } from './interceptors/api-call-tracking.interceptor';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { DriveModule } from '../drive/drive.module';
import { WorkflowAppModule } from '../workflow-app/workflow-app.module';
import { CanvasModule } from '../canvas/canvas.module';
import { MiscModule } from '../misc/misc.module';
import { CopilotAutogenModule } from '../copilot-autogen/copilot-autogen.module';

/**
 * OpenAPI Module
 * Provides authenticated API endpoints for external integrations
 * All endpoints require API Key authentication
 *
 * Current endpoints:
 * - Workflow API (run workflows, get execution status)
 * - File Upload API (upload files for workflow use)
 *
 * Future endpoints:
 * - Account API (user management, settings)
 * - Storage API (file operations)
 * - Knowledge API (knowledge base operations)
 * - etc.
 */
@Module({
  imports: [
    CommonModule,
    AuthModule,
    WorkflowModule,
    DriveModule,
    MiscModule,
    WorkflowAppModule,
    CanvasModule,
    CopilotAutogenModule,
  ],
  controllers: [
    WorkflowApiController,
    OpenapiWorkflowsController,
    FileUploadController,
    OpenapiConfigController,
    OpenapiCopilotController,
    // Future: AccountApiController,
    // Future: StorageApiController,
    // Future: KnowledgeApiController,
  ],
  providers: [
    OpenapiService,
    FileUploadService,
    ApiKeyAuthGuard,
    RateLimitGuard,
    DebounceGuard,
    ApiCallTrackingInterceptor,
  ],
  exports: [OpenapiService, FileUploadService],
})
export class OpenapiModule {}
