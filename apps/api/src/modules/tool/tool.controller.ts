import { Body, Controller, Get, ParseBoolPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '@prisma/client';
import { buildSuccessResponse } from '../../utils/response';
import { ToolService } from './tool.service';
import { ToolExecutionService, ToolDefinitionService } from './ptc';
import {
  BaseResponse,
  ListToolsResponse,
  DeleteToolsetRequest,
  ListToolsetsResponse,
  UpsertToolsetResponse,
  UpsertToolsetRequest,
  ListToolsetInventoryResponse,
  ListUserToolsResponse,
  GetToolCallResultResponse,
  ExecuteToolRequest,
  ExecuteToolResponse,
  ExportToolsetDefinitionsResponse,
} from '@refly/openapi-schema';
import { toolsetPO2DTO } from './tool.dto';

@Controller('v1/tool')
export class ToolController {
  constructor(
    private readonly toolService: ToolService,
    private readonly toolExecutionService: ToolExecutionService,
    private readonly toolDefinitionService: ToolDefinitionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('/list')
  async listTools(
    @LoginedUser() user: UserModel,
    @Query('isGlobal', new ParseBoolPipe({ optional: true })) isGlobal: boolean,
    @Query('enabled', new ParseBoolPipe({ optional: true })) enabled: boolean,
    @Query('includeUnauthorized', new ParseBoolPipe({ optional: true }))
    includeUnauthorized: boolean,
  ): Promise<ListToolsResponse> {
    // If includeUnauthorized is true, use listAllToolsForCopilot which includes unauthorized tools
    if (includeUnauthorized) {
      const tools = await this.toolService.listAllToolsForCopilot(user);
      const populatedTools = await this.toolService.populateToolsetsWithDefinition(tools);
      return buildSuccessResponse(populatedTools);
    }

    const tools = await this.toolService.listTools(user, {
      isGlobal,
      enabled,
    });
    // Populate toolsets with definition from inventory
    const populatedTools = await this.toolService.populateToolsetsWithDefinition(tools);
    return buildSuccessResponse(populatedTools);
  }

  /**
   * List all tools including UnAuthorized tools for the user
   * @param user
   * @returns
   */

  @UseGuards(JwtAuthGuard)
  @Get('/user/list')
  async listUserTools(@LoginedUser() user: UserModel): Promise<ListUserToolsResponse> {
    const userTools = await this.toolService.listUserTools(user);
    return buildSuccessResponse(userTools);
  }

  @Get('/inventory/list')
  async listToolsetInventory(): Promise<ListToolsetInventoryResponse> {
    const toolsets = await this.toolService.listToolsetInventory();
    return buildSuccessResponse(toolsets);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/toolset/list')
  async listToolsets(
    @LoginedUser() user: UserModel,
    @Query('isGlobal', new ParseBoolPipe({ optional: true })) isGlobal?: boolean,
  ): Promise<ListToolsetsResponse> {
    // Use listTools to get all tool types (regular, OAuth, builtin)
    // Filter out MCP tools since they don't have toolset property
    const tools = await this.toolService.listTools(user, { isGlobal });
    const toolsets = tools.filter((tool) => tool.toolset).map((tool) => tool.toolset);
    return buildSuccessResponse(toolsets);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/toolset/create')
  async createToolset(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertToolsetRequest,
  ): Promise<UpsertToolsetResponse> {
    const toolset = await this.toolService.createToolset(user, body);
    return buildSuccessResponse(toolsetPO2DTO(toolset));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/toolset/update')
  async updateToolset(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertToolsetRequest,
  ): Promise<UpsertToolsetResponse> {
    const toolset = await this.toolService.updateToolset(user, body);
    return buildSuccessResponse(toolsetPO2DTO(toolset));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/toolset/delete')
  async deleteTool(
    @LoginedUser() user: UserModel,
    @Body() body: DeleteToolsetRequest,
  ): Promise<BaseResponse> {
    await this.toolService.deleteToolset(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/toolset/exportDefinitions')
  async exportToolsetDefinitions(
    @Query('toolsetKey') toolsetKey?: string,
  ): Promise<ExportToolsetDefinitionsResponse> {
    const definitions = await this.toolDefinitionService.exportToolsetDefinitions(toolsetKey);
    return buildSuccessResponse(definitions);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/call/result')
  async getToolCallResult(
    @LoginedUser() user: UserModel,
    @Query('toolCallId') toolCallId: string,
  ): Promise<GetToolCallResultResponse> {
    const result = await this.toolService.getToolCallResult(user, toolCallId);
    return buildSuccessResponse({ result });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/execute')
  async executeTool(
    @LoginedUser() user: UserModel,
    @Body() request: ExecuteToolRequest,
    @Req() req: Request,
  ): Promise<ExecuteToolResponse> {
    // Extract PTC context from headers
    const headers = req?.headers ?? {};
    const ptcCallId = headers?.['x-ptc-call-id'] as string | undefined;
    const resultId = headers?.['x-refly-result-id'] as string | undefined;
    const versionStr = headers?.['x-refly-result-version'] as string | undefined;
    const canvasId = headers?.['x-refly-canvas-id'] as string | undefined;
    const version = versionStr ? Number.parseInt(versionStr, 10) : undefined;

    const result = await this.toolExecutionService.executeTool(user, request, {
      ptcCallId,
      resultId,
      version,
      canvasId,
    });
    return buildSuccessResponse(result);
  }
}
