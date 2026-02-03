import { Controller, Get, Logger, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { User } from '@prisma/client';
import { OpenapiService } from '../openapi.service';
import { buildSuccessResponse } from '../../../utils/response';
import type { ListOrder } from '@refly/openapi-schema';
import { ApiCallTrackingInterceptor } from '../interceptors/api-call-tracking.interceptor';

type WorkflowSearchQuery = {
  keyword?: string;
  order?: ListOrder;
  page?: string;
  pageSize?: string;
};

@ApiTags('OpenAPI - Workflow')
@Controller('v1/openapi/workflows')
@UseInterceptors(ApiCallTrackingInterceptor)
export class OpenapiWorkflowsController {
  private readonly logger = new Logger(OpenapiWorkflowsController.name);

  constructor(private readonly openapiService: OpenapiService) {}

  @Get()
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Search workflows via API' })
  async searchWorkflows(@Query() query: WorkflowSearchQuery, @LoginedUser() user: User) {
    this.logger.log(`[API_SEARCH_WORKFLOWS] uid=${user.uid}`);

    const page = query.page ? Number(query.page) : undefined;
    const pageSize = query.pageSize ? Number(query.pageSize) : undefined;
    const result = await this.openapiService.searchWorkflows(
      { uid: user.uid },
      {
        keyword: query.keyword,
        order: query.order,
        page,
        pageSize,
      },
    );

    return buildSuccessResponse(result);
  }

  @Get(':canvasId')
  @UseGuards(ApiKeyAuthGuard, RateLimitGuard)
  @ApiOperation({ summary: 'Get workflow detail via API' })
  async getWorkflowDetail(@Param('canvasId') canvasId: string, @LoginedUser() user: User) {
    this.logger.log(`[API_GET_WORKFLOW_DETAIL] uid=${user.uid} canvasId=${canvasId}`);

    const plan = await this.openapiService.getWorkflowPlan({ uid: user.uid }, canvasId);
    return buildSuccessResponse(plan);
  }
}
