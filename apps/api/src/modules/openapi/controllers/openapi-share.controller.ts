import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ApiCallTrackingInterceptor } from '../interceptors/api-call-tracking.interceptor';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { buildSuccessResponse } from '../../../utils/response';
import { ShareCreationService } from '../../share/share-creation.service';
import { ShareCommonService } from '../../share/share-common.service';
import { ShareDuplicationService } from '../../share/share-duplication.service';
import { shareRecordPO2DTO } from '../../share/share.dto';
import { MiscService } from '../../misc/misc.service';
import type {
  OpenapiCreateWorkflowShareRequest,
  OpenapiDuplicateWorkflowShareRequest,
  OpenapiCreateWorkflowShareResponse,
  OpenapiDuplicateWorkflowShareResponse,
  BaseResponse,
} from '@refly/openapi-schema';

@ApiTags('OpenAPI - Share')
@Controller('v1/openapi/share/workflow')
@UseInterceptors(ApiCallTrackingInterceptor)
export class OpenapiShareController {
  private readonly logger = new Logger(OpenapiShareController.name);
  private readonly shareWaitIntervalMs = 500;
  private readonly shareWaitTimeoutMs = 30000;

  constructor(
    private readonly shareCreationService: ShareCreationService,
    private readonly shareCommonService: ShareCommonService,
    private readonly shareDuplicationService: ShareDuplicationService,
    private readonly miscService: MiscService,
  ) {}

  @Post(':canvasId')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Create workflow share via API' })
  async createWorkflowShare(
    @Param('canvasId') canvasId: string,
    @Body() body: OpenapiCreateWorkflowShareRequest,
    @LoginedUser() user: User,
  ): Promise<OpenapiCreateWorkflowShareResponse> {
    this.logger.log(`[API_CREATE_WORKFLOW_SHARE] uid=${user.uid} canvasId=${canvasId}`);

    const result = await this.shareCreationService.createShare(user, {
      entityType: 'canvas',
      entityId: canvasId,
      title: body.title,
      allowDuplication: body.allowDuplication ?? false,
    });

    await this.waitForShareReady(result.storageKey, result.shareId);

    return buildSuccessResponse(shareRecordPO2DTO(result));
  }

  @Delete(':shareId')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Delete workflow share via API' })
  async deleteWorkflowShare(
    @Param('shareId') shareId: string,
    @LoginedUser() user: User,
  ): Promise<BaseResponse> {
    this.logger.log(`[API_DELETE_WORKFLOW_SHARE] uid=${user.uid} shareId=${shareId}`);

    await this.shareCommonService.deleteShare(user, { shareId });

    return buildSuccessResponse(null);
  }

  @Post(':shareId/duplicate')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Duplicate shared workflow via API' })
  async duplicateWorkflowShare(
    @Param('shareId') shareId: string,
    @Body() body: OpenapiDuplicateWorkflowShareRequest,
    @LoginedUser() user: User,
  ): Promise<OpenapiDuplicateWorkflowShareResponse> {
    this.logger.log(`[API_DUPLICATE_WORKFLOW_SHARE] uid=${user.uid} shareId=${shareId}`);

    const result = await this.shareDuplicationService.duplicateShare(user, {
      shareId,
      canvasId: body.canvasId,
      title: body.title,
    });

    return buildSuccessResponse(result);
  }

  private async waitForShareReady(storageKey: string, shareId: string): Promise<void> {
    const startTime = Date.now();
    while (true) {
      const ready = await this.miscService.fileStorageExists(storageKey, 'public');
      if (ready) return;
      if (Date.now() - startTime > this.shareWaitTimeoutMs) {
        this.logger.warn(`Share content wait timeout: shareId=${shareId}`);
        throw new Error('Share content wait timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, this.shareWaitIntervalMs));
    }
  }
}
