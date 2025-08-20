import { Body, Controller, Get, ParseBoolPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '../../generated/client';
import { buildSuccessResponse } from '../../utils/response';
import { ToolService } from './tool.service';
import {
  BaseResponse,
  ListToolsResponse,
  DeleteToolRequest,
  ListToolsetsResponse,
  UpsertToolsetResponse,
  UpsertToolsetRequest,
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
  ): Promise<ListToolsResponse> {
    const tools = await this.toolService.listTools(user, {
      isGlobal,
    });
    return buildSuccessResponse(tools);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/toolset/list')
  async listToolsets(
    @LoginedUser() user: UserModel,
    @Query('isGlobal', new ParseBoolPipe({ optional: true })) isGlobal: boolean,
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
    @Body() body: DeleteToolRequest,
  ): Promise<BaseResponse> {
    await this.toolService.deleteTool(user, body);
    return buildSuccessResponse();
  }
}
