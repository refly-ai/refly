import { Module, forwardRef } from '@nestjs/common';
import { OpenapiService } from './openapi.service';
import { FileUploadService } from './file-upload.service';
import { WorkflowApiController } from './controllers/workflow-api.controller';
import { FileUploadController } from './controllers/file-upload.controller';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { DebounceGuard } from './guards/debounce.guard';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { DriveModule } from '../drive/drive.module';

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
    forwardRef(() => AuthModule),
    forwardRef(() => WorkflowModule),
    forwardRef(() => DriveModule),
  ],
  controllers: [
    WorkflowApiController,
    FileUploadController,
    // Future: AccountApiController,
    // Future: StorageApiController,
    // Future: KnowledgeApiController,
  ],
  providers: [OpenapiService, FileUploadService, ApiKeyAuthGuard, RateLimitGuard, DebounceGuard],
  exports: [OpenapiService, FileUploadService],
})
export class OpenapiModule {}
