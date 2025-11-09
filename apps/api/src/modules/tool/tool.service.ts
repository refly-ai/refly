import { DynamicStructuredTool, type StructuredToolInterface } from '@langchain/core/tools';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnyToolsetClass,
  BuiltinToolset,
  BuiltinToolsetDefinition,
  builtinToolsetInventory,
  toolsetInventory,
  GenerateWorkflow,
} from '@refly/agent-tools';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import { ParamsError, ToolsetNotFoundError } from '@refly/errors';
import {
  CanvasNode,
  DeleteToolsetRequest,
  DynamicConfigItem,
  GenericToolset,
  ListToolsData,
  ToolsetAuthType,
  ToolsetDefinition,
  UpsertToolsetRequest,
  User,
} from '@refly/openapi-schema';
import { genToolsetID, safeParseJSON, validateConfig } from '@refly/utils';
import {
  convertMcpServersToClientConfig,
  MultiServerMCPClient,
  SkillEngine,
} from '@refly/skill-template';
import { Queue } from 'bullmq';
import { McpServer as McpServerPO, Prisma, Toolset as ToolsetPO } from '../../generated/client';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../utils/const';
import { EncryptionService } from '../common/encryption.service';
import { PrismaService } from '../common/prisma.service';
import { CreditService } from '../credit/credit.service';
import { SyncToolCreditUsageJobData } from '../credit/credit.dto';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { ComposioService } from './composio/composio.service';
import {
  mcpServerPo2GenericToolset,
  toolsetPo2GenericOAuthToolset,
  toolsetPo2GenericToolset,
} from './tool.dto';

@Injectable()
export class ToolService {
  private logger = new Logger(ToolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
    private readonly mcpServerService: McpServerService,
    private readonly composioService: ComposioService,
    private readonly creditService: CreditService,
    @Optional()
    @InjectQueue(QUEUE_SYNC_TOOL_CREDIT_USAGE)
    private readonly toolCreditUsageQueue?: Queue<SyncToolCreditUsageJobData>,
  ) {}

  get toolsetInventory(): Record<
    string,
    {
      class: AnyToolsetClass;
      definition: ToolsetDefinition;
    }
  > {
    const supportedToolsets = this.configService.get<string>('tools.supportedToolsets');

    if (!supportedToolsets) {
      return toolsetInventory;
    }

    const supportedToolsetsArray = supportedToolsets.split(',');
    return Object.fromEntries(
      Object.entries(toolsetInventory).filter(([key]) => supportedToolsetsArray.includes(key)),
    );
  }

  listToolsetInventory(): ToolsetDefinition[] {
    return Object.values(this.toolsetInventory)
      .map((toolset) => toolset.definition)
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  listBuiltinTools(): GenericToolset[] {
    return Object.values(builtinToolsetInventory).map((toolset) => ({
      type: 'regular' as const,
      id: toolset.definition.key,
      name: (toolset.definition.labelDict?.en as string) ?? toolset.definition.key,
      builtin: true,
      toolset: {
        toolsetId: 'builtin',
        key: toolset.definition.key,
        name: (toolset.definition.labelDict?.en as string) ?? toolset.definition.key,
        definition: toolset.definition,
      },
    }));
  }

  async listRegularTools(user: User, param?: ListToolsData['query']): Promise<GenericToolset[]> {
    const { isGlobal, enabled } = param ?? {};

    // Build where condition dynamically
    const whereCondition: any = {
      uninstalled: false,
      deletedAt: null,
      OR:
        isGlobal !== undefined
          ? [{ isGlobal }, { uid: user.uid }]
          : [{ isGlobal: true }, { uid: user.uid }],
      ...(enabled !== undefined && { enabled }),
    };

    const toolsets = await this.prisma.toolset.findMany({
      where: whereCondition,
    });
    return toolsets.map(toolsetPo2GenericToolset);
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
    const builtinTools = this.listBuiltinTools();
    const [regularTools, mcpTools] = await Promise.all([
      this.listRegularTools(user, param),
      this.listMcpTools(user, param),
    ]);
    return [...builtinTools, ...regularTools, ...mcpTools];
  }

  /**
   * Assemble OAuth authData from config and account table
   */
  private async verifyOAuthConn(user: User, appSlug: string): Promise<Record<string, unknown>> {
    const connection = await this.prisma.composioConnection.findFirst({
      where: {
        uid: user.uid,
        integrationId: appSlug,
        deletedAt: null,
      },
    });

    if (connection) {
      const metadata = connection.metadata ? safeParseJSON(connection.metadata) : undefined;
      return metadata;
    }
    throw new ParamsError(`Composio connection not found for appSlug: ${appSlug}`);
  }

  async createToolset(user: User, param: UpsertToolsetRequest): Promise<ToolsetPO> {
    const { name, key, enabled, authType, authData, config } = param;

    if (!name) {
      throw new ParamsError('name is required');
    }

    if (!key) {
      throw new ParamsError('key is required');
    } else if (!this.toolsetInventory[key]) {
      throw new ParamsError(`Toolset ${key} not valid`);
    }

    // Get toolset definition for validation
    const toolsetDefinition = this.toolsetInventory[key]?.definition;
    if (!toolsetDefinition) {
      throw new ParamsError(`Toolset definition not found for key: ${key}`);
    }

    let finalAuthData = authData;

    if (toolsetDefinition.requiresAuth) {
      if (!authType) {
        throw new ParamsError(`authType is required for toolset ${key}`);
      }

      // Handle OAuth type: assemble authData from config and account table
      if (authType === ('oauth' as ToolsetAuthType)) {
        finalAuthData = await this.verifyOAuthConn(user, param.key);
      } else {
        // For non-OAuth types, authData is required from request
        if (!authData) {
          throw new ParamsError(`authData is required for toolset ${key}`);
        }
        finalAuthData = authData;
      }
      // Validate authData against toolset schema (skip for OAuth type)
      if (authType !== ('oauth' as ToolsetAuthType)) {
        this.validateAuthData(finalAuthData, toolsetDefinition, authType);
      }
    }

    // Validate config against toolset schema
    if (config && toolsetDefinition.configItems) {
      this.validateConfig(config, toolsetDefinition.configItems);
    }

    let encryptedAuthData: string | null = null;
    try {
      if (finalAuthData) {
        encryptedAuthData = this.encryptionService.encrypt(JSON.stringify(finalAuthData));
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

    // Set default creditBilling for OAuth toolsets
    const creditBilling = authType === ('oauth' as ToolsetAuthType) ? '3' : null;

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
          creditBilling,
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
        creditBilling,
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
    if (param.key !== undefined && param.key !== toolset.key) {
      throw new ParamsError(`Toolset key ${param.key} cannot be updated`);
    }
    if (param.enabled !== undefined) {
      updates.enabled = param.enabled;
    }
    if (param.authType !== undefined) {
      updates.authType = param.authType;
    }
    if (param.authData !== undefined) {
      let finalAuthData = param.authData;

      // Handle OAuth type: assemble authData from config and account table
      const authType = param.authType ?? toolset.authType;
      if (authType === ('oauth' as ToolsetAuthType)) {
        finalAuthData = await this.verifyOAuthConn(user, param.key);
      }

      // Validate authData against toolset schema (skip for OAuth type)
      const toolsetDefinition = toolsetInventory[param.key ?? toolset.key]?.definition;
      if (toolsetDefinition?.requiresAuth && authType !== ('oauth' as ToolsetAuthType)) {
        this.validateAuthData(finalAuthData, toolsetDefinition, authType);
      }

      const encryptedAuthData = this.encryptionService.encrypt(JSON.stringify(finalAuthData));
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
      const { type, id, selectedTools, builtin } = selectedToolset;

      if (type === 'regular') {
        if (builtin) {
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
      if (toolset.builtin) {
        continue;
      }

      let importedToolset: GenericToolset | null = null;

      if (toolset.type === 'regular') {
        importedToolset = await this.importRegularToolset(user, toolset);
      } else if (toolset.type === 'mcp') {
        importedToolset = await this.importMcpToolset(user, toolset);
      } else if (toolset.type === 'external_oauth') {
        importedToolset = await this.importOAuthToolset(user, toolset);
      } else {
        this.logger.warn(`Unknown toolset type: ${toolset.type}, skipping`);
      }

      if (importedToolset) {
        importedToolsets.push(importedToolset);
        replaceToolsetMap[toolset.id] = importedToolset;
      }
    }

    this.logger.log(`Imported toolsets: ${JSON.stringify(replaceToolsetMap)}`);

    return { toolsets: importedToolsets, replaceToolsetMap };
  }

  async importToolsetsFromNodes(
    user: User,
    nodes: CanvasNode[],
  ): Promise<{ replaceToolsetMap: Record<string, GenericToolset> }> {
    if (!nodes?.length) {
      return { replaceToolsetMap: {} };
    }

    const toolsetsWithNodes = extractToolsetsWithNodes(nodes).map((t) => t.toolset);
    const { replaceToolsetMap } = await this.importToolsets(user, toolsetsWithNodes);

    return { replaceToolsetMap };
  }

  /**
   * Import a regular toolset - search for existing or create uninstalled
   */
  private async importRegularToolset(
    user: User,
    toolset: GenericToolset,
  ): Promise<GenericToolset | null> {
    const { name, toolset: toolsetInstance, builtin } = toolset;

    if (!toolsetInstance) {
      this.logger.warn(`Regular toolset missing toolset instance, skipping: ${name}`);
      return null;
    }

    // For regular toolsets, we search by key (not ID since ID is user-specific)
    const key = toolsetInstance?.key || toolset.id;

    if (!key) {
      this.logger.warn(`Regular toolset missing key, skipping: ${name}`);
      return null;
    }

    // Builtin toolset does not need to be imported
    if (builtin) {
      return null;
    }

    // Global toolsets are not imported
    if (toolsetInstance?.isGlobal) {
      return null;
    }

    // Check if toolset key exists in inventory
    const toolsetDefinition = this.toolsetInventory[key];
    if (!toolsetDefinition) {
      this.logger.warn(`Toolset key not found in inventory: ${key}, skipping`);
      return null;
    }

    // Search for existing toolset with same key for this user
    const existingToolsets = await this.prisma.toolset.findMany({
      where: {
        key,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (existingToolsets?.length && existingToolsets.length > 0) {
      const validUserToolset = existingToolsets.find(
        (t) => t.uid === user.uid && !t.isGlobal && t.enabled && !t.uninstalled,
      );
      if (validUserToolset) {
        this.logger.debug(
          `Found existing regular user-specific toolset for key ${key}, toolset id: ${validUserToolset.toolsetId}`,
        );
        return toolsetPo2GenericToolset(validUserToolset);
      }

      const validGlobalToolset = existingToolsets.find((t) => t.isGlobal && t.enabled);
      if (validGlobalToolset) {
        this.logger.debug(
          `Found existing regular global toolset for key ${key}, toolset id: ${validGlobalToolset.toolsetId}`,
        );
        return toolsetPo2GenericToolset(validGlobalToolset);
      }

      // Return the first existing toolset if no valid user or global toolset is found
      return toolsetPo2GenericToolset(existingToolsets[0]);
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

  private async importOAuthToolset(
    user: User,
    toolset: GenericToolset,
  ): Promise<GenericToolset | null> {
    const integrationId = toolset.toolset?.key;
    const activeConnection = await this.prisma.composioConnection.findFirst({
      where: {
        uid: user.uid,
        integrationId,
        status: 'active',
        deletedAt: null,
      },
    });

    if (!activeConnection) {
      return null;
    }

    const existingToolset = await this.prisma.toolset.findFirst({
      where: {
        uid: user.uid,
        key: integrationId,
        authType: 'oauth',
        deletedAt: null,
      },
    });
    if (!existingToolset) {
      return null;
    }
    return toolsetPo2GenericOAuthToolset(existingToolset);
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
    const builtinKeys = toolsets.filter((t) => t.type === 'regular' && t.builtin).map((t) => t.id);
    let builtinTools: DynamicStructuredTool[] = [];
    if (builtinKeys.length > 0) {
      builtinTools = this.instantiateBuiltinToolsets(user, engine, builtinKeys);
    }

    let copilotTools: DynamicStructuredTool[] = [];
    if (toolsets.find((t) => t.type === 'regular' && t.id === 'copilot')) {
      copilotTools = this.instantiateCopilotToolsets();
    }

    const regularToolsets = toolsets.filter((t) => t.type === 'regular' && !t.builtin);
    const mcpServers = toolsets.filter((t) => t.type === 'mcp');

    const [regularTools, mcpTools, oauthToolsets] = await Promise.all([
      this.instantiateRegularToolsets(user, regularToolsets, engine),
      this.instantiateMcpServers(user, mcpServers),
      this.instantiateOAuthToolsets(user, toolsets),
    ]);
    return [
      ...builtinTools,
      ...copilotTools,
      ...(Array.isArray(regularTools) ? regularTools : []),
      ...(Array.isArray(mcpTools) ? mcpTools : []),
      ...(Array.isArray(oauthToolsets) ? oauthToolsets : []),
    ];
  }

  /**
   * Instantiate builtin toolsets into structured tools.
   */
  private instantiateBuiltinToolsets(
    user: User,
    engine: SkillEngine,
    keys: string[],
  ): DynamicStructuredTool[] {
    const toolsetInstance = new BuiltinToolset({
      reflyService: engine.service,
      user,
    });

    return BuiltinToolsetDefinition.tools
      ?.filter((tool) => keys.includes(tool.name))
      ?.map((tool) => toolsetInstance.getToolInstance(tool.name))
      .map(
        (tool) =>
          new DynamicStructuredTool({
            name: `${BuiltinToolsetDefinition.key}_${tool.name}`,
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

  private instantiateCopilotToolsets(): DynamicStructuredTool[] {
    const toolsetInstance = new GenerateWorkflow();

    return [
      new DynamicStructuredTool({
        name: 'copilot_generate_workflow',
        description: toolsetInstance.description,
        schema: toolsetInstance.schema,
        func: toolsetInstance.invoke.bind(toolsetInstance),
        metadata: {
          name: toolsetInstance.name,
          type: 'copilot',
          toolsetKey: 'copilot',
          toolsetName: 'Copilot',
        },
      }),
    ];
  }

  /**
   * Instantiate selected regular toolsets into structured tools.
   */
  private async instantiateRegularToolsets(
    user: User,
    toolsets: GenericToolset[],
    engine: SkillEngine,
  ): Promise<DynamicStructuredTool[]> {
    if (!toolsets?.length) {
      return [];
    }

    const toolsetPOs = await this.prisma.toolset.findMany({
      where: {
        toolsetId: { in: toolsets.map((t) => t.id) },
        deletedAt: null,
        OR: [
          {
            uid: user.uid,
            OR: [{ authType: { not: 'oauth' } }, { authType: null }],
          },
          {
            isGlobal: true,
            OR: [{ authType: { not: 'oauth' } }, { authType: null }],
          },
        ],
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
      const toolsetInstance = new toolset.class({
        ...config,
        ...authData,
        reflyService: engine.service,
        user,
        isGlobalToolset: t?.isGlobal ?? false,
        engine, // Pass SkillEngine instance for tools that need LLM access
      });

      return toolset.definition.tools
        ?.map((tool) => toolsetInstance.getToolInstance(tool.name))
        .map(
          (tool) =>
            new DynamicStructuredTool({
              name: `${toolset.definition.key}_${tool.name}`,
              description: tool.description,
              schema: tool.schema,
              func: async (input, _config) => {
                const result = await tool.invoke(input);
                const isGlobal = t?.isGlobal ?? false;
                const creditCost = (result as any)?.creditCost ?? 0;
                const resultId = (_config as any)?.metadata?.resultId as string;
                const version = (_config as any)?.metadata?.version as number;
                if (isGlobal && result?.status !== 'error' && creditCost > 0) {
                  const jobData: SyncToolCreditUsageJobData = {
                    uid: user.uid,
                    creditCost,
                    timestamp: new Date(),
                    toolsetName: t?.name ?? (toolset.definition.labelDict?.en as string) ?? t?.key,
                    toolName: tool.name,
                    resultId,
                    version,
                  };
                  await this.creditService.syncToolCreditUsage(jobData);
                }
                return result;
              },
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

  private async instantiateOAuthToolsets(
    user: User,
    toolsets: GenericToolset[],
  ): Promise<StructuredToolInterface[]> {
    return this.composioService.instantiateOAuthToolsets(user, toolsets);
  }
}
