import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { Prisma, Toolset as ToolsetPO } from '../../generated/client';
import {
  DeleteToolRequest,
  GenericToolset,
  ListToolsData,
  UpsertToolsetRequest,
  User,
} from '@refly/openapi-schema';
import { genToolsetID } from '@refly/utils';
import { ParamsError, ToolsetNotFoundError } from '@refly/errors';
import { mcpServerPo2GenericToolset, toolsetPo2GenericToolset } from './tool.dto';
import { McpServerService } from '../mcp-server/mcp-server.service';

@Injectable()
export class ToolService {
  private logger = new Logger(ToolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly mcpServerService: McpServerService,
  ) {}

  async listRegularTools(user: User, param: ListToolsData['query']): Promise<GenericToolset[]> {
    const { isGlobal } = param;
    const toolsets = await this.prisma.toolset.findMany({
      where: {
        OR: [{ isGlobal }, { uid: user.uid }],
        deletedAt: null,
      },
    });
    return toolsets.map(toolsetPo2GenericToolset);
  }

  async listMcpTools(user: User, param: ListToolsData['query']): Promise<GenericToolset[]> {
    const { isGlobal } = param;
    const servers = await this.mcpServerService.listMcpServers(user, {
      enabled: true,
      isGlobal,
    });
    return servers.map(mcpServerPo2GenericToolset);
  }

  async listTools(user: User, param: ListToolsData['query']): Promise<GenericToolset[]> {
    const [regularTools, mcpTools] = await Promise.all([
      this.listRegularTools(user, param),
      this.listMcpTools(user, param),
    ]);
    return [...regularTools, ...mcpTools];
  }

  async createToolset(user: User, param: UpsertToolsetRequest): Promise<ToolsetPO> {
    const { name, key, authType, authData } = param;

    if (!name) {
      throw new ParamsError('name is required');
    }

    // TODO: check if key is valid
    if (!key) {
      throw new ParamsError('key is required');
    }
    if (!authType) {
      throw new ParamsError('authType is required');
    }

    let encryptedAuthData: string;
    try {
      encryptedAuthData = this.encryptionService.encrypt(JSON.stringify(authData));
    } catch {
      throw new ParamsError('Invalid authData');
    }

    const toolset = await this.prisma.toolset.create({
      data: {
        toolsetId: genToolsetID(),
        name,
        key,
        authType,
        authData: encryptedAuthData,
        uid: user.uid,
      },
    });

    return toolset;
  }

  async updateToolset(user: User, param: UpsertToolsetRequest): Promise<ToolsetPO> {
    const { toolsetId } = param;

    if (!toolsetId) {
      throw new ParamsError('toolsetId is required');
    }

    const toolset = await this.prisma.toolset.findUnique({
      where: {
        toolsetId,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (!toolset) {
      throw new ToolsetNotFoundError(`Toolset ${toolsetId} not found`);
    }

    if (toolset.isGlobal) {
      throw new ParamsError('Global toolset cannot be updated');
    }

    const updates: Prisma.ToolsetUpdateInput = {};

    if (param.name !== undefined) {
      updates.name = param.name;
    }
    // TODO: check if key is valid
    if (param.key !== undefined) {
      updates.key = param.key;
    }
    if (param.authType !== undefined) {
      updates.authType = param.authType;
    }
    if (param.authData !== undefined) {
      const encryptedAuthData = this.encryptionService.encrypt(JSON.stringify(param.authData));
      updates.authData = encryptedAuthData;
    }

    const updatedToolset = await this.prisma.toolset.update({
      where: { toolsetId, uid: user.uid },
      data: updates,
    });

    return updatedToolset;
  }

  async deleteTool(user: User, param: DeleteToolRequest): Promise<void> {
    const { toolsetId } = param;

    const toolset = await this.prisma.toolset.findUnique({
      where: {
        uid: user.uid,
        toolsetId,
        deletedAt: null,
      },
    });

    if (!toolset) {
      throw new ToolsetNotFoundError(`Toolset ${toolsetId} not found`);
    }

    await this.prisma.toolset.delete({
      where: { pk: toolset.pk },
    });
  }
}
