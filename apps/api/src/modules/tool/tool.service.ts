import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool, type StructuredToolInterface } from '@langchain/core/tools';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { Prisma, Toolset as ToolsetPO, McpServer as McpServerPO } from '../../generated/client';
import {
  DeleteToolsetRequest,
  DynamicConfigItem,
  GenericToolset,
  ListToolsData,
  ToolsetDefinition,
  UpsertToolsetRequest,
  User,
} from '@refly/openapi-schema';
import { genToolsetID, safeParseJSON, validateConfig } from '@refly/utils';
import { BuiltinToolset, BuiltinToolsetDefinition, toolsetInventory } from '@refly/agent-tools';
import { ParamsError, ToolsetNotFoundError } from '@refly/errors';
import { mcpServerPo2GenericToolset, toolsetPo2GenericToolset } from './tool.dto';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';
import {
  convertMcpServersToClientConfig,
  MultiServerMCPClient,
  SkillEngine,
} from '@refly/skill-template';

@Injectable()
export class ToolService {
  private logger = new Logger(ToolService.name);

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

  async listRegularTools(user: User, param?: ListToolsData['query']): Promise<GenericToolset[]> {
    const builtinToolset: GenericToolset = {
      type: 'regular',
      id: 'builtin',
      name: 'Builtin',
      builtin: true,
      toolset: {
        toolsetId: 'builtin',
        name: 'Builtin',
        definition: BuiltinToolsetDefinition,
      },
    };
    const { isGlobal, enabled } = param ?? {};
    const toolsets = await this.prisma.toolset.findMany({
      where: {
        OR: [{ isGlobal }, { uid: user.uid }],
        enabled,
        uninstalled: false,
        deletedAt: null,
      },
    });
    return [builtinToolset, ...toolsets.map(toolsetPo2GenericToolset)];
  }

  async listMcpTools(user: User, param?: ListToolsData['query']): Promise<GenericToolset[]> {
    const { isGlobal, enabled } = param ?? {};
    const servers = await this.mcpServerService.listMcpServers(user, {
      enabled,
      isGlobal,
    });
    return servers.map(mcpServerPo2GenericToolset);
  }

  async listTools(user: User, param?: ListToolsData['query']): Promise<GenericToolset[]> {
    const [regularTools, mcpTools] = await Promise.all([
      this.listRegularTools(user, param),
      this.listMcpTools(user, param),
    ]);
    return [...regularTools, ...mcpTools];
  }

  async createToolset(user: User, param: UpsertToolsetRequest): Promise<ToolsetPO> {
    const { name, key, enabled, authType, authData, config } = param;

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
    if (config && toolsetDefinition.configItems) {
      this.validateConfig(config, toolsetDefinition.configItems);
    }

    let encryptedAuthData: string | null = null;
    try {
      if (authData) {
        encryptedAuthData = this.encryptionService.encrypt(JSON.stringify(authData));
      }
    } catch {
      throw new ParamsError('Invalid authData');
    }

    // Check if there is any uninstalled toolset with the same key
    const uninstalledToolset = await this.prisma.toolset.findFirst({
      select: {
        pk: true,
        toolsetId: true,
      },
      where: {
        key,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        uninstalled: true,
        deletedAt: null,
      },
    });

    // If there is any uninstalled toolset with the same key, update it to installed
    if (uninstalledToolset) {
      this.logger.log(
        `Detected uninstalled toolset ${key}: ${uninstalledToolset.toolsetId}, updating to installed`,
      );
      return this.prisma.toolset.update({
        where: { pk: uninstalledToolset.pk },
        data: {
          uninstalled: false,
          enabled,
          authType,
          authData: encryptedAuthData,
          config: config ? JSON.stringify(config) : null,
          uid: user.uid,
        },
      });
    }

    const toolset = await this.prisma.toolset.create({
      data: {
        toolsetId: genToolsetID(),
        name,
        key,
        enabled,
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
    if (param.enabled !== undefined) {
      updates.enabled = param.enabled;
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
      if (toolsetDefinition?.configItems) {
        this.validateConfig(config, toolsetDefinition.configItems);
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

  async validateSelectedToolsets(user: User, toolsets: GenericToolset[]): Promise<void> {
    if (!toolsets?.length) {
      return; // No toolsets to validate
    }

    const startTime = Date.now();
    this.logger.debug(
      `Starting validation of ${toolsets.length} selected toolsets for user ${user.uid}`,
    );

    // Separate regular toolsets and MCP servers for batch processing
    const regularToolsetIds: string[] = [];
    const mcpServerNames: string[] = [];
    const toolsetToolMap = new Map<string, string[]>();
    const mcpToolMap = new Map<string, string[]>();

    for (const selectedToolset of toolsets) {
      const { type, id, selectedTools } = selectedToolset;

      if (type === 'regular') {
        if (id === 'builtin') {
          continue;
        }
        regularToolsetIds.push(id);
        if (selectedTools?.length) {
          toolsetToolMap.set(id, selectedTools);
        }
      } else if (type === 'mcp') {
        mcpServerNames.push(id);
        if (selectedTools?.length) {
          mcpToolMap.set(id, selectedTools);
        }
      } else {
        throw new ParamsError('Invalid toolset selection: missing type or required fields');
      }
    }

    // Early return if no toolsets to validate
    if (regularToolsetIds.length === 0 && mcpServerNames.length === 0) {
      this.logger.debug('No toolsets to validate, returning early');
      return;
    }

    this.logger.log(
      `Validating ${regularToolsetIds.length} regular toolsets and ${mcpServerNames.length} MCP servers`,
    );

    // Batch query for regular toolsets
    let regularToolsets: ToolsetPO[] = [];
    if (regularToolsetIds.length > 0) {
      const toolsetQueryStart = Date.now();
      regularToolsets = await this.prisma.toolset.findMany({
        where: {
          toolsetId: { in: regularToolsetIds },
          OR: [{ uid: user.uid }, { isGlobal: true }],
          deletedAt: null,
        },
      });
      this.logger.debug(
        `Regular toolsets query took ${Date.now() - toolsetQueryStart}ms, found ${regularToolsets.length} toolsets`,
      );
    }

    // Batch query for MCP servers
    let mcpServers: McpServerPO[] = [];
    if (mcpServerNames.length > 0) {
      const mcpQueryStart = Date.now();
      mcpServers = await this.prisma.mcpServer.findMany({
        where: {
          name: { in: mcpServerNames },
          OR: [{ uid: user.uid }, { isGlobal: true }],
          deletedAt: null,
        },
      });
      this.logger.debug(
        `MCP servers query took ${Date.now() - mcpQueryStart}ms, found ${mcpServers.length} servers`,
      );
    }

    // Validate regular toolsets
    for (const toolset of regularToolsets) {
      const selectedTools = toolsetToolMap.get(toolset.toolsetId);
      await this.validateRegularToolset(toolset, selectedTools);
    }

    // Check for missing regular toolsets
    const foundToolsetIds = new Set(regularToolsets.map((t) => t.toolsetId));
    const missingToolsetIds = regularToolsetIds.filter((id) => !foundToolsetIds.has(id));
    if (missingToolsetIds.length > 0) {
      throw new ToolsetNotFoundError(
        `Toolsets not found or not accessible: ${missingToolsetIds.join(', ')}`,
      );
    }

    // Validate MCP servers
    for (const server of mcpServers) {
      const selectedTools = mcpToolMap.get(server.name);
      this.validateMcpServer(server, selectedTools);
    }

    // Check for missing MCP servers
    const foundServerNames = new Set(mcpServers.map((s) => s.name));
    const missingServerNames = mcpServerNames.filter((name) => !foundServerNames.has(name));
    if (missingServerNames.length > 0) {
      throw new ParamsError(
        `MCP servers not found or not accessible: ${missingServerNames.join(', ')}`,
      );
    }

    const totalTime = Date.now() - startTime;
    this.logger.debug(
      `Validation completed successfully in ${totalTime}ms for ${toolsets.length} toolsets`,
    );
  }

  /**
   * Validate that a regular toolset exists and is accessible to the user
   */
  private async validateRegularToolset(
    toolset: ToolsetPO,
    selectedTools?: string[],
  ): Promise<void> {
    // Validate that the toolset key exists in inventory
    if (!toolsetInventory[toolset.key]) {
      throw new ParamsError(`Toolset ${toolset.key} is not valid`);
    }

    // Validate selected tools if specified
    if (selectedTools?.length) {
      this.validateToolsetTools(toolset.key, selectedTools);
    }
  }

  /**
   * Validate that an MCP server exists and is accessible to the user
   */
  private validateMcpServer(server: McpServerPO, selectedTools?: string[]): void {
    if (!server.enabled) {
      throw new ParamsError(`MCP server ${server.name} is not enabled`);
    }

    // Validate selected tools if specified
    if (selectedTools?.length) {
      // For MCP servers, we can't validate tools at this level since they're dynamic
      // The actual tool validation will happen when the MCP client is initialized
      this.logger.debug(`MCP server ${server.name} selected tools: ${selectedTools.join(', ')}`);
    }
  }

  /**
   * Validate that the selected tools exist in the toolset
   */
  private validateToolsetTools(toolsetKey: string, selectedTools: string[]): void {
    const toolset = toolsetInventory[toolsetKey];
    if (!toolset) {
      throw new ParamsError(`Toolset ${toolsetKey} not found in inventory`);
    }

    const availableTools = toolset.definition.tools?.map((tool) => tool.name) ?? [];

    for (const toolName of selectedTools) {
      if (!availableTools.includes(toolName)) {
        throw new ParamsError(
          `Tool ${toolName} not found in toolset ${toolsetKey}. Available tools: ${availableTools.join(', ')}`,
        );
      }
    }
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

    // Validate auth data if auth type is credentials
    if (authType === 'credentials') {
      this.validateConfig(authData, authPattern.credentialItems);
    }
  }

  /**
   * Import toolsets from other users. Useful when duplicating canvases between users.
   */
  async importToolsets(
    user: User,
    toolsets: GenericToolset[],
  ): Promise<{ toolsets: GenericToolset[]; replaceToolsetMap: Record<string, GenericToolset> }> {
    if (!toolsets?.length) {
      return { toolsets: [], replaceToolsetMap: {} };
    }

    const importedToolsets: GenericToolset[] = [];
    const replaceToolsetMap: Record<string, GenericToolset> = {};

    for (const toolset of toolsets) {
      let importedToolset: GenericToolset | null = null;

      if (toolset.type === 'regular') {
        importedToolset = await this.importRegularToolset(user, toolset);
      } else if (toolset.type === 'mcp') {
        importedToolset = await this.importMcpToolset(user, toolset);
      } else {
        this.logger.warn(`Unknown toolset type: ${toolset.type}, skipping`);
      }

      if (importedToolset) {
        importedToolsets.push(importedToolset);
        replaceToolsetMap[toolset.id] = importedToolset;
      }
    }

    return { toolsets: importedToolsets, replaceToolsetMap };
  }

  /**
   * Import a regular toolset - search for existing or create uninstalled
   */
  private async importRegularToolset(
    user: User,
    toolset: GenericToolset,
  ): Promise<GenericToolset | null> {
    const { name, toolset: toolsetInstance } = toolset;

    // For regular toolsets, we search by key (not ID since ID is user-specific)
    const key = toolsetInstance?.key || toolset.id;

    if (!key) {
      this.logger.warn(`Regular toolset missing key, skipping: ${name}`);
      return null;
    }

    // Builtin toolset does not need to be imported
    if (key === 'builtin') {
      return null;
    }

    // Check if toolset key exists in inventory
    const toolsetDefinition = toolsetInventory[key];
    if (!toolsetDefinition) {
      this.logger.warn(`Toolset key not found in inventory: ${key}, skipping`);
      return null;
    }

    // Search for existing toolset with same key for this user
    const existingToolset = await this.prisma.toolset.findFirst({
      where: {
        key,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (existingToolset) {
      this.logger.debug(
        `Found existing regular toolset for key ${key}: ${existingToolset.toolsetId}`,
      );
      return toolsetPo2GenericToolset(existingToolset);
    }

    // Create uninstalled toolset with pre-generated ID
    const toolsetId = genToolsetID();
    const createdToolset = await this.prisma.toolset.create({
      data: {
        toolsetId,
        name: name || (toolsetDefinition.definition.labelDict?.en as string) || key,
        key,
        uid: user.uid,
        enabled: false, // Uninstalled toolsets are disabled
        uninstalled: true,
      },
    });

    this.logger.log(`Created uninstalled regular toolset: ${toolsetId} for key ${key}`);
    return toolsetPo2GenericToolset(createdToolset);
  }

  /**
   * Import an MCP toolset - search for existing or create uninstalled
   */
  private async importMcpToolset(user: User, toolset: GenericToolset): Promise<GenericToolset> {
    const { name, mcpServer } = toolset;

    if (!name || !mcpServer) {
      this.logger.warn(`MCP toolset missing name or mcpServer, skipping: ${name}`);
      return null;
    }

    // Search for existing MCP server with same name for this user
    const existingServer = await this.prisma.mcpServer.findFirst({
      where: {
        name,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (existingServer) {
      this.logger.debug(`Found existing MCP server: ${name}`);
      return mcpServerPo2GenericToolset(existingServer);
    }

    const clearMcpFields = (obj: Record<string, string>): Record<string, string> => {
      return Object.fromEntries(Object.entries(obj).map(([key, _]) => [key, '']));
    };

    return {
      ...toolset,
      mcpServer: {
        ...mcpServer,
        headers: mcpServer.headers ? clearMcpFields(mcpServer.headers) : undefined,
        env: mcpServer.env ? clearMcpFields(mcpServer.env) : undefined,
      },
    };
  }

  /**
   * Validate config against the toolset's config schema
   */
  private validateConfig(config: Record<string, unknown>, configItems: DynamicConfigItem[]): void {
    const result = validateConfig(config, configItems);
    if (!result.isValid) {
      throw new ParamsError(`Invalid config: ${result.errors.join('; ')}`);
    }
  }

  /**
   * Instantiate toolsets into structured tools, ready to be used in skill invocation.
   */
  async instantiateToolsets(
    user: User,
    toolsets: GenericToolset[],
    engine: SkillEngine,
  ): Promise<StructuredToolInterface[]> {
    let builtinTools: DynamicStructuredTool[] = [];
    if (toolsets.find((t) => t.type === 'regular' && t.id === 'builtin')) {
      builtinTools = this.instantiateBuiltinToolsets(user, engine);
    }

    const regularToolsets = toolsets.filter((t) => t.type === 'regular' && t.id !== 'builtin');
    const mcpServers = toolsets.filter((t) => t.type === 'mcp');

    const [regularTools, mcpTools] = await Promise.all([
      this.instantiateRegularToolsets(user, regularToolsets),
      this.instantiateMcpServers(user, mcpServers),
    ]);

    return [
      ...builtinTools,
      ...(Array.isArray(regularTools) ? regularTools : []),
      ...(Array.isArray(mcpTools) ? mcpTools : []),
    ];
  }

  /**
   * Instantiate builtin toolsets into structured tools.
   */
  private instantiateBuiltinToolsets(user: User, engine: SkillEngine): DynamicStructuredTool[] {
    const toolsetInstance = new BuiltinToolset({
      reflyService: engine.service,
      user,
    });

    return BuiltinToolsetDefinition.tools
      ?.map((tool) => toolsetInstance.getToolInstance(tool.name))
      .map(
        (tool) =>
          new DynamicStructuredTool({
            name: tool.name,
            description: tool.description,
            schema: tool.schema,
            func: tool.invoke.bind(tool),
            metadata: {
              name: tool.name,
              type: 'regular',
              toolsetKey: 'builtin',
              toolsetName: 'Builtin',
            },
          }),
      );
  }

  /**
   * Instantiate selected regular toolsets into structured tools.
   */
  private async instantiateRegularToolsets(
    user: User,
    toolsets: GenericToolset[],
  ): Promise<DynamicStructuredTool[]> {
    if (!toolsets?.length) {
      return [];
    }

    const toolsetPOs = await this.prisma.toolset.findMany({
      where: {
        toolsetId: { in: toolsets.map((t) => t.id) },
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    const tools = toolsetPOs.flatMap((t) => {
      const toolset = toolsetInventory[t.key];
      if (!toolset) {
        throw new ParamsError(`Toolset ${t.key} not found in inventory`);
      }

      const config = t.config ? safeParseJSON(t.config) : {};
      const authData = t.authData ? safeParseJSON(this.encryptionService.decrypt(t.authData)) : {};

      // TODO: check for constructor parameters
      const toolsetInstance = new toolset.class({ ...config, ...authData });

      return toolset.definition.tools
        ?.map((tool) => toolsetInstance.getToolInstance(tool.name))
        .map(
          (tool) =>
            new DynamicStructuredTool({
              name: tool.name,
              description: tool.description,
              schema: tool.schema,
              func: tool.invoke.bind(tool),
              metadata: {
                name: tool.name,
                type: 'regular',
                toolsetKey: t.key,
                toolsetName: t.name,
              },
            }),
        );
    });

    return tools;
  }

  /**
   * Instantiate selected MCP servers into structured tools, by creating a MCP client and getting the tools.
   */
  private async instantiateMcpServers(
    user: User,
    mcpServers: GenericToolset[],
  ): Promise<StructuredToolInterface[]> {
    if (!mcpServers?.length) {
      return [];
    }

    const mcpServerNames = mcpServers.map((s) => s.name);
    const mcpServerList = await this.mcpServerService
      .listMcpServers(user, { enabled: true })
      .then((data) => data.filter((item) => mcpServerNames.includes(item.name)));

    // TODO: should return cleanup function to close the client
    let tempMcpClient: MultiServerMCPClient | undefined;

    try {
      // Pass mcpServersResponse (which is ListMcpServersResponse) to convertMcpServersToClientConfig
      const mcpClientConfig = convertMcpServersToClientConfig({
        data: mcpServerList.map(mcpServerPO2DTO),
      });
      tempMcpClient = new MultiServerMCPClient(mcpClientConfig);

      await tempMcpClient.initializeConnections();
      this.logger.log('MCP connections initialized successfully for new components');

      const toolsFromMcp = (await tempMcpClient.getTools()) as StructuredToolInterface[];
      if (!toolsFromMcp || toolsFromMcp.length === 0) {
        this.logger.warn(
          `No MCP tools found for user ${user.uid} after initializing client. Proceeding without MCP tools.`,
        );
        if (tempMcpClient) {
          await tempMcpClient
            .close()
            .catch((closeError) =>
              this.logger.error(
                'Error closing MCP client when no tools found after connection:',
                closeError,
              ),
            );
        }
      } else {
        this.logger.log(
          `Loaded ${toolsFromMcp.length} MCP tools: ${toolsFromMcp
            .map((tool) => tool.name)
            .join(', ')}`,
        );
      }

      return toolsFromMcp;
    } catch (mcpError) {
      this.logger.error(
        `Error during MCP client operation (initializeConnections or getTools): ${mcpError?.stack}`,
      );
      if (tempMcpClient) {
        await tempMcpClient
          .close()
          .catch((closeError) =>
            this.logger.error('Error closing MCP client after operation failure:', closeError),
          );
      }
      return [];
    }
  }
}
