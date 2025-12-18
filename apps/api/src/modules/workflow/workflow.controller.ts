import { Controller, Post, Body, UseGuards, Get, Query, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '@prisma/client';
import { WorkflowService } from './workflow.service';
import {
  InitializeWorkflowRequest,
  InitializeWorkflowResponse,
  GetWorkflowDetailResponse,
  AbortWorkflowRequest,
  BaseResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { ParamsError } from '@refly/errors';
import { workflowExecutionPO2DTO } from './workflow.dto';
import { SkillInvokerService } from '../skill/skill-invoker.service';

@Controller('v1/workflow')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(
    private readonly workflowService: WorkflowService,
    private readonly skillInvokerService: SkillInvokerService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  async initializeWorkflow(
    @LoginedUser() user: UserModel,
    @Body() request: InitializeWorkflowRequest,
  ): Promise<InitializeWorkflowResponse> {
    const executionId = await this.workflowService.initializeWorkflowExecution(
      user,
      request.canvasId,
      request.variables,
      {
        sourceCanvasId: request.sourceCanvasId,
        sourceCanvasData: request.sourceCanvasData,
        createNewCanvas: request.createNewCanvas,
        nodeBehavior: request.nodeBehavior,
        startNodes: request.startNodes,
        checkCanvasOwnership: true,
      },
    );

    return buildSuccessResponse({ workflowExecutionId: executionId });
  }

  @UseGuards(JwtAuthGuard)
  @Post('abort')
  async abortWorkflow(
    @LoginedUser() user: UserModel,
    @Body() request: AbortWorkflowRequest,
  ): Promise<BaseResponse> {
    if (!request.executionId) {
      throw new ParamsError('Execution ID is required');
    }

    const startTime = Date.now();
    this.logger.log(
      `[WORKFLOW_ABORT][REQ] executionId=${request.executionId} uid=${user.uid} phase=request`,
    );

    try {
      await this.workflowService.abortWorkflow(user, request.executionId);
      this.logger.log(
        `[WORKFLOW_ABORT][REQ] executionId=${request.executionId} phase=completed elapsed=${Date.now() - startTime}ms`,
      );
      return buildSuccessResponse(null);
    } catch (error) {
      this.logger.error(
        `[WORKFLOW_ABORT][REQ] executionId=${request.executionId} phase=failed error=${error?.message} elapsed=${Date.now() - startTime}ms`,
      );
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('detail')
  async getWorkflowDetail(
    @LoginedUser() user: UserModel,
    @Query('executionId') executionId: string,
  ): Promise<GetWorkflowDetailResponse> {
    if (!executionId) {
      throw new ParamsError('Execution ID is required');
    }

    const workflowDetail = await this.workflowService.getWorkflowDetail(user, executionId);
    return buildSuccessResponse(workflowExecutionPO2DTO(workflowDetail));
  }

  @UseGuards(JwtAuthGuard)
  @Get('lastDetail')
  async getLatestWorkflowDetail(
    @LoginedUser() user: UserModel,
    @Query('canvasId') canvasId: string,
  ): Promise<GetWorkflowDetailResponse> {
    if (!canvasId) {
      throw new ParamsError('Canvas ID is required');
    }

    const workflowDetail = await this.workflowService.getLatestWorkflowDetail(user, canvasId);
    return buildSuccessResponse(workflowExecutionPO2DTO(workflowDetail));
  }

  @UseGuards(JwtAuthGuard)
  @Get('allDetails')
  async getAllWorkflowDetails(
    @LoginedUser() user: UserModel,
    @Query('canvasId') canvasId?: string,
  ) {
    const workflowDetails = await this.workflowService.getAllWorkflowDetails(user, canvasId);
    return buildSuccessResponse(workflowDetails.map(workflowExecutionPO2DTO));
  }
}
