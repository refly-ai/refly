import { Body, Controller, Get, ParseBoolPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '@prisma/client';
import { buildSuccessResponse } from '../../utils/response';
import { ToolService } from './tool.service';
import {
  BaseResponse,
  ListToolsResponse,
  DeleteToolsetRequest,
  ListToolsetsResponse,
  UpsertToolsetResponse,
  UpsertToolsetRequest,
  ListToolsetInventoryResponse,
} from '@refly/openapi-schema';
import { toolsetPO2DTO } from './tool.dto';

@Controller('v1/tool')
export class ToolController {
  constructor(private readonly toolService: ToolService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/list')
  async listTools(
    @LoginedUser() user: UserModel,
    @Query('isGlobal', new ParseBoolPipe({ optional: true })) isGlobal: boolean,
    @Query('enabled', new ParseBoolPipe({ optional: true })) enabled: boolean,
  ): Promise<ListToolsResponse> {
    const tools = await this.toolService.listTools(user, {
      isGlobal,
      enabled,
    });
    // Populate toolsets with definition from inventory
    const populatedTools = await this.toolService.populateToolsetsWithDefinition(tools);
    return buildSuccessResponse(populatedTools);
  }

  @UseGuards(JwtAuthGuard)
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
    const toolsets = await this.toolService.listRegularTools(user, { isGlobal });
    return buildSuccessResponse(toolsets.map((toolset) => toolset.toolset));
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
}
