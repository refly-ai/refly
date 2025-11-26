import { Body, Controller, Get, ParseBoolPipe, Post, Query, UseGuards } from '@nestjs/common';
import { McpServerService } from './mcp-server.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '@prisma/client';
import {
  DeleteMcpServerRequest,
  DeleteMcpServerResponse,
  ListMcpServersResponse,
  McpServerType,
  UpsertMcpServerRequest,
  UpsertMcpServerResponse,
  ValidateMcpServerResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import { mcpServerPO2DTO } from './mcp-server.dto';

@Controller('v1/mcp-server')
export class McpServerController {
  constructor(private readonly mcpServerService: McpServerService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/list')
  async listMcpServers(
    @LoginedUser() user: UserModel,
    @Query('type') type: McpServerType,
    @Query('enabled', new ParseBoolPipe({ optional: true })) enabled: boolean,
  ): Promise<ListMcpServersResponse> {
    const servers = await this.mcpServerService.listMcpServers(user, { enabled, type });
    return buildSuccessResponse(servers.map(mcpServerPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create')
  async createMcpServer(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertMcpServerRequest,
  ): Promise<UpsertMcpServerResponse> {
    const server = await this.mcpServerService.createMcpServer(user, body);
    return buildSuccessResponse(mcpServerPO2DTO(server));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/update')
  async updateMcpServer(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertMcpServerRequest,
  ): Promise<UpsertMcpServerResponse> {
    const server = await this.mcpServerService.updateMcpServer(user, body);
    return buildSuccessResponse(mcpServerPO2DTO(server));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/delete')
  async deleteMcpServer(
    @LoginedUser() user: UserModel,
    @Body() body: DeleteMcpServerRequest,
  ): Promise<DeleteMcpServerResponse> {
    await this.mcpServerService.deleteMcpServer(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Post('/validate')
  async validateMcpServer(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertMcpServerRequest,
  ): Promise<ValidateMcpServerResponse> {
    const resp = await this.mcpServerService.validateMcpServer(user, body);
    return buildSuccessResponse(resp);
  }
}
