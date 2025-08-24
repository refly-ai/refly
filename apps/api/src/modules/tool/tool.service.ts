import { Injectable, Logger } from '@nestjs/common';
import Ajv from 'ajv';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { Prisma, Toolset as ToolsetPO } from '../../generated/client';
import {
  DeleteToolsetRequest,
  GenericToolset,
  ListToolsData,
  ToolsetDefinition,
  UpsertToolsetRequest,
  User,
} from '@refly/openapi-schema';
import { genToolsetID } from '@refly/utils';
import { toolsetInventory } from '@refly/agent-tools';
import { ParamsError, ToolsetNotFoundError } from '@refly/errors';
import { mcpServerPo2GenericToolset, toolsetPo2GenericToolset } from './tool.dto';
import { McpServerService } from '../mcp-server/mcp-server.service';

@Injectable()
export class ToolService {
  private logger = new Logger(ToolService.name);
  private ajv = new Ajv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly mcpServerService: McpServerService,
  ) {}

  listToolsetInventory(): ToolsetDefinition[] {
    return Object.values(toolsetInventory)
      .map((toolset) => toolset.definition)
      .sort((a, b) => a.key.localeCompare(b.key));
  }

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
    const { name, key, authType, authData, config } = param;

    if (!name) {
      throw new ParamsError('name is required');
    }

    if (!key) {
      throw new ParamsError('key is required');
    } else if (!toolsetInventory[key]) {
      throw new ParamsError(`Toolset ${key} not valid`);
    }

    // Get toolset definition for validation
    const toolsetDefinition = toolsetInventory[key]?.definition;
    if (!toolsetDefinition) {
      throw new ParamsError(`Toolset definition not found for key: ${key}`);
    }

    if (toolsetDefinition.requiresAuth) {
      if (!authType || !authData) {
        throw new ParamsError(`authType and authData are required for toolset ${key}`);
      }

      // Validate authData against toolset schema
      this.validateAuthData(authData, toolsetDefinition, authType);
    }

    // Validate config against toolset schema
    if (config && toolsetDefinition.configSchema) {
      this.validateConfig(config, toolsetDefinition.configSchema);
    }

    let encryptedAuthData: string | null = null;
    try {
      if (authData) {
        encryptedAuthData = this.encryptionService.encrypt(JSON.stringify(authData));
      }
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
        config: config ? JSON.stringify(config) : null,
        uid: user.uid,
      },
    });

    return toolset;
  }

  async updateToolset(user: User, param: UpsertToolsetRequest): Promise<ToolsetPO> {
    const { toolsetId, config } = param;

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
    if (param.key !== undefined) {
      if (!toolsetInventory[param.key]) {
        throw new ParamsError(`Toolset ${param.key} not valid`);
      }
      updates.key = param.key;
    }
    if (param.authType !== undefined) {
      updates.authType = param.authType;
    }
    if (param.authData !== undefined) {
      // Validate authData against toolset schema
      const toolsetDefinition = toolsetInventory[param.key ?? toolset.key]?.definition;
      if (toolsetDefinition?.requiresAuth) {
        this.validateAuthData(
          param.authData,
          toolsetDefinition,
          param.authType ?? toolset.authType,
        );
      }

      const encryptedAuthData = this.encryptionService.encrypt(JSON.stringify(param.authData));
      updates.authData = encryptedAuthData;
    }
    if (config !== undefined) {
      // Validate config against toolset schema
      const toolsetDefinition = toolsetInventory[param.key ?? toolset.key]?.definition;
      if (toolsetDefinition?.configSchema) {
        this.validateConfig(config, toolsetDefinition.configSchema);
      }

      updates.config = JSON.stringify(config);
    }

    const updatedToolset = await this.prisma.toolset.update({
      where: { toolsetId, uid: user.uid },
      data: updates,
    });

    return updatedToolset;
  }

  async deleteToolset(user: User, param: DeleteToolsetRequest): Promise<void> {
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

    await this.prisma.toolset.update({
      where: { pk: toolset.pk },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Validate authData against the toolset's auth patterns
   */
  private validateAuthData(
    authData: Record<string, unknown>,
    toolsetDefinition: ToolsetDefinition,
    authType: string,
  ): void {
    if (!toolsetDefinition.authPatterns?.length) {
      throw new ParamsError(`Toolset ${toolsetDefinition.key} does not support authentication`);
    }

    // Find matching auth pattern
    const authPattern = toolsetDefinition.authPatterns.find((pattern) => pattern.type === authType);
    if (!authPattern) {
      throw new ParamsError(
        `Auth type '${authType}' is not supported by toolset ${toolsetDefinition.key}`,
      );
    }

    // Validate credentials schema if present
    if (authPattern.credentialSchema && authType === 'credentials') {
      const validate = this.ajv.compile(authPattern.credentialSchema);
      if (!validate(authData)) {
        const errors = validate.errors
          ?.map((err) => `${err.instancePath} ${err.message}`)
          .join(', ');
        throw new ParamsError(`Invalid auth data: ${errors}`);
      }
    }
  }

  /**
   * Validate config against the toolset's config schema
   */
  private validateConfig(
    config: Record<string, unknown>,
    configSchema: Record<string, unknown>,
  ): void {
    const validate = this.ajv.compile(configSchema);
    if (!validate(config)) {
      const errors = validate.errors?.map((err) => `${err.instancePath} ${err.message}`).join(', ');
      throw new ParamsError(`Invalid config: ${errors}`);
    }
  }
}
