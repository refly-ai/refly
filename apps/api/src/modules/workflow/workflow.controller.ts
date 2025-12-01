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
import { PrismaService } from '../common/prisma.service';

@Controller('v1/workflow')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(
    private readonly workflowService: WorkflowService,
    private readonly prisma: PrismaService,
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

    await this.workflowService.abortWorkflowExecution(user, request.executionId);
    return buildSuccessResponse(null);
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

  /**
   * Test endpoint for workflow initialization without authentication
   * WARNING: This is for local testing only! Remove in production.
   */
  @Post('initialize-test')
  async initializeWorkflowTest(
    @Body() request: InitializeWorkflowRequest & { uid: string },
  ): Promise<InitializeWorkflowResponse> {
    this.logger.warn('[Test API] Using unauthenticated workflow initialization endpoint');

    if (!request.uid) {
      throw new ParamsError('uid is required for test endpoint');
    }

    // Get user from database
    const prismaUser = await this.prisma.user.findUnique({
      where: { uid: request.uid },
    });

    if (!prismaUser) {
      throw new ParamsError('User not found');
    }

    this.logger.log(`[Test API] Initializing workflow for user ${request.uid}`);

    // Create a serializable user object (without BigInt fields) to avoid JSON serialization issues in BullMQ
    // This is necessary because Prisma User objects contain BigInt fields that cannot be serialized to JSON
    const serializableUser = {
      uid: prismaUser.uid,
      email: prismaUser.email,
    } as UserModel;

    const executionId = await this.workflowService.initializeWorkflowExecution(
      serializableUser,
      request.canvasId,
      request.variables,
      {
        sourceCanvasId: request.sourceCanvasId,
        sourceCanvasData: request.sourceCanvasData,
        createNewCanvas: request.createNewCanvas,
        nodeBehavior: request.nodeBehavior,
        startNodes: request.startNodes,
        checkCanvasOwnership: false, // Skip ownership check for test endpoint
      },
    );

    this.logger.log(`[Test API] Workflow initialized with execution ID: ${executionId}`);
    return buildSuccessResponse({ workflowExecutionId: executionId });
  }

  /**
   * Test endpoint for getting workflow detail without authentication
   * WARNING: This is for local testing only! Remove in production.
   */
  @Get('detail-test')
  async getWorkflowDetailTest(
    @Query('executionId') executionId: string,
    @Query('uid') uid: string,
  ): Promise<GetWorkflowDetailResponse> {
    this.logger.warn('[Test API] Using unauthenticated workflow detail endpoint');

    if (!executionId) {
      throw new ParamsError('Execution ID is required');
    }

    if (!uid) {
      throw new ParamsError('uid is required for test endpoint');
    }

    // Get user from database
    const prismaUser = await this.prisma.user.findUnique({
      where: { uid },
    });

    if (!prismaUser) {
      throw new ParamsError('User not found');
    }

    this.logger.log(`[Test API] Getting workflow detail for user ${uid}, execution ${executionId}`);

    // Create a serializable user object
    const serializableUser = {
      uid: prismaUser.uid,
      email: prismaUser.email,
    } as UserModel;

    const workflowDetail = await this.workflowService.getWorkflowDetail(
      serializableUser,
      executionId,
    );
    return buildSuccessResponse(workflowExecutionPO2DTO(workflowDetail));
  }
}
