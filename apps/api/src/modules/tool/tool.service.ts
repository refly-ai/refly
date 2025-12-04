import { DynamicStructuredTool, type StructuredToolInterface } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnyToolsetClass,
  BuiltinToolset,
  BuiltinToolsetDefinition,
  GenerateWorkflow,
  builtinToolsetInventory,
  toolsetInventory,
} from '@refly/agent-tools';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import { ParamsError, ToolsetNotFoundError } from '@refly/errors';
import {
  CanvasNode,
  DeleteToolsetRequest,
  DynamicConfigItem,
  GenericToolset,
  ListToolsData,
  SkillContext,
  ToolCallResult,
  ToolsetAuthType,
  ToolsetDefinition,
  UpsertToolsetRequest,
  User,
  UserTool,
} from '@refly/openapi-schema';
import {
  MultiServerMCPClient,
  SkillEngine,
  SkillRunnableConfig,
  convertMcpServersToClientConfig,
} from '@refly/skill-template';
import { genToolsetID, safeParseJSON, validateConfig } from '@refly/utils';
import { SingleFlightCache } from '../../utils/cache';
import { McpServer as McpServerPO, Prisma, Toolset as ToolsetPO } from '@prisma/client';
import { EncryptionService } from '../common/encryption.service';
import { PrismaService } from '../common/prisma.service';
import { SyncToolCreditUsageJobData } from '../credit/credit.dto';
import { CreditService } from '../credit/credit.service';
import { mcpServerPO2DTO } from '../mcp-server/mcp-server.dto';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { MiscService } from '../misc/misc.service';
import { ComposioService } from './composio/composio.service';
import { AuthType, ToolsetType } from './constant';
import { ToolFactory } from './dynamic-tooling/factory.service';
import { ToolInventoryService } from './inventory/inventory.service';
import {
  mcpServerPo2GenericToolset,
  populateToolsets,
  toolsetPo2GenericOAuthToolset,
  toolsetPo2GenericToolset,
} from './tool.dto';

@Injectable()
export class ToolService {
  private logger = new Logger(ToolService.name);
  private toolsetInventoryCache: SingleFlightCache<ToolsetDefinition[]>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
    private readonly mcpServerService: McpServerService,
    private readonly composioService: ComposioService,
    private readonly creditService: CreditService,
    private readonly toolFactory: ToolFactory,
    private readonly miscService: MiscService,
    private readonly inventoryService: ToolInventoryService,
  ) {
    // Cache toolset inventory with 5-minute TTL
    this.toolsetInventoryCache = new SingleFlightCache(this.loadToolsetInventory.bind(this), {
      ttl: 5 * 60 * 1000,
    });
  }

  async getToolsetInventory(): Promise<
    Record<
      string,
      {
        class: AnyToolsetClass;
        definition: ToolsetDefinition;
      }
    >
  > {
    const supportedToolsets = this.configService.get<string>('tools.supportedToolsets');
    const inventoryMap = await this.inventoryService.getInventoryMap();

    if (!supportedToolsets) {
      return inventoryMap;
    }

    const supportedToolsetsArray = supportedToolsets.split(',');
    return Object.fromEntries(
      Object.entries(inventoryMap).filter(([key]) => supportedToolsetsArray.includes(key)),
    );
  }

  /**
   * Load toolset inventory from sources (builtin + external)
   */
  private async loadToolsetInventory(): Promise<ToolsetDefinition[]> {
    const builtinInventory = Object.values(builtinToolsetInventory).map((toolset) => ({
      ...toolset.definition,
      builtin: true,
    }));
    const definitions = await this.inventoryService.getInventoryDefinitions();
    return [...builtinInventory, ...definitions].sort((a, b) => a.key.localeCompare(b.key));
  }

  async listToolsetInventory(): Promise<ToolsetDefinition[]> {
    return this.toolsetInventoryCache.get();
  }

  /**
   * List user tools for mention list
   * Returns installed tools (authorized) and uninstalled external OAuth tools (unauthorized)
   */
  async listUserTools(user: User): Promise<UserTool[]> {
    // 1. Get all installed tools for current user (enabled)
    const installedTools = await this.listTools(user, { enabled: true });
    const populatedTools = await this.populateToolsetsWithDefinition(installedTools);

    // 2. Get installed toolset keys for filtering
    const installedKeys = new Set(populatedTools.map((t) => t.toolset?.key).filter(Boolean));

    // 3. Get all external OAuth tools from inventory that are not installed
    // external_oauth type tools have requiresAuth=true and authPatterns with type='oauth'
    const allDefinitions = await this.inventoryService.getInventoryDefinitions();
    const unauthorizedTools = allDefinitions.filter(
      (def) => def.requiresAuth && !installedKeys.has(def.key),
    );

    // 4. Build result: authorized tools first, then unauthorized
    const authorizedItems: UserTool[] = populatedTools.map((tool) => ({
      toolsetId: tool.id,
      key: tool.toolset?.key || tool.id,
      name: tool.name,
      description: (tool.toolset?.definition?.descriptionDict?.en as string) || tool.name,
      authorized: true,
      domain: tool.toolset?.definition?.domain,
      toolset: tool,
    }));

    const unauthorizedItems: UserTool[] = unauthorizedTools.map((def) => ({
      toolsetId: def.key,
      key: def.key,
      name: (def.labelDict?.en as string) || def.key,
      description: (def.descriptionDict?.en as string) || '',
      authorized: false,
      domain: def.domain,
      definition: def,
    }));

    return [...authorizedItems, ...unauthorizedItems];
  }

  listBuiltinTools(): GenericToolset[] {
    return Object.values(builtinToolsetInventory)
      .filter((toolset) => Boolean(toolset.definition) && !toolset.definition.internal)
      .map((toolset) => ({
        type: ToolsetType.REGULAR,
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

  /**
   * List OAuth-based tools from active Composio connections
   * Queries active integrations from composio_connections and returns corresponding toolsets
   */
  async listOAuthTools(user: User, param?: ListToolsData['query']): Promise<GenericToolset[]> {
    const { enabled } = param ?? {};
    // Get active Composio connections for the user
    const activeConnections = await this.prisma.composioConnection.findMany({
      where: {
        uid: user.uid,
        status: 'active',
        deletedAt: null,
      },
      select: {
        integrationId: true,
      },
    });

    if (activeConnections.length === 0) {
      return [];
    }

    // Extract integration IDs
    const integrationIds = activeConnections.map((conn) => conn.integrationId);

    // Query toolsets with matching keys (integration_id = toolset.key)
    const oauthToolsets = await this.prisma.toolset.findMany({
      where: {
        key: { in: integrationIds },
        authType: AuthType.OAUTH,
        uninstalled: false,
        deletedAt: null,
        uid: user.uid,
        ...(enabled !== undefined && { enabled }),
      },
    });
    const inventoryMap = await this.inventoryService.getInventoryMap();
    return oauthToolsets.map((toolset) => toolsetPo2GenericToolset(toolset, inventoryMap));
  }

  /**
   * List regular tools
   * Combines both regular (code-based) and config_based (database-configured) toolsets
   * Excludes OAuth toolsets (they are handled by listOAuthTools)
   */
  async listRegularTools(user: User, param?: ListToolsData['query']): Promise<GenericToolset[]> {
    const { isGlobal, enabled } = param ?? {};

    // Build where condition dynamically
    // Exclude OAuth toolsets to avoid duplicates with listOAuthTools
    const whereCondition: any = {
      uninstalled: false,
      deletedAt: null,
      authType: { not: AuthType.OAUTH },
      OR:
        isGlobal !== undefined
          ? [{ isGlobal }, { uid: user.uid }]
          : [{ isGlobal: true }, { uid: user.uid }],
      ...(enabled !== undefined && { enabled }),
    };

    const toolsets = await this.prisma.toolset.findMany({
      where: whereCondition,
    });
    const inventoryMap = await this.inventoryService.getInventoryMap();
    return toolsets.map((toolset) => toolsetPo2GenericToolset(toolset, inventoryMap));
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
    const [regularTools, oauthTools, mcpTools] = await Promise.all([
      this.listRegularTools(user, param), // Includes both regular
      this.listOAuthTools(user, param), // OAuth tools from Composio connections
      this.listMcpTools(user, param), // MCP server tools
    ]);
    return [...builtinTools, ...regularTools, ...oauthTools, ...mcpTools];
  }

  /**
   * Populate toolsets with definitions from inventory (for canvas and other use cases)
   * This is a simpler version that only uses inventory data, no user-specific data
   */
  async populateToolsetsWithDefinition(toolsets: GenericToolset[]): Promise<GenericToolset[]> {
    if (!Array.isArray(toolsets) || toolsets.length === 0) {
      return [];
    }

    // Get inventory map from service
    const inventoryMap = await this.inventoryService.getInventoryMap();

    // Use DTO method to populate
    return populateToolsets(toolsets, inventoryMap);
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
    }

    const inventoryItem = await this.inventoryService.getInventoryItem(key);
    if (!inventoryItem) {
      throw new ParamsError(`Inventory item not found for key: ${key}`);
    }

    // Get toolset definition for validation
    const toolsetDefinition = inventoryItem.definition;
    if (!toolsetDefinition) {
      throw new ParamsError(`Toolset definition not found for key: ${key}`);
    }

    let finalAuthData = authData;

    if (toolsetDefinition?.requiresAuth) {
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
    if (config) {
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
      const toolsetDefinition = (
        await this.inventoryService.getInventoryItem(param.key ?? toolset.key)
      )?.definition;
      if (toolsetDefinition?.requiresAuth && authType !== ('oauth' as ToolsetAuthType)) {
        this.validateAuthData(finalAuthData, toolsetDefinition, authType);
      }

      const encryptedAuthData = this.encryptionService.encrypt(JSON.stringify(finalAuthData));
      updates.authData = encryptedAuthData;
    }
    if (config !== undefined) {
      // Validate config against toolset schema
      const toolsetDefinition = (
        await this.inventoryService.getInventoryItem(param.key ?? toolset.key)
      )?.definition;
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

      if (type === ToolsetType.REGULAR) {
        if (builtin) {
          continue;
        }
        regularToolsetIds.push(id);
        if (selectedTools?.length) {
          toolsetToolMap.set(id, selectedTools);
        }
      } else if (type === ToolsetType.MCP) {
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
    // Config-based toolsets don't need inventory validation
    // They are dynamically loaded from database
    if (toolset.authType === 'config_based') {
      return;
    }

    // Validate that the toolset key exists in inventory
    if (!(await this.inventoryService.hasInventoryItem(toolset.key))) {
      throw new ParamsError(`Toolset ${toolset.key} is not valid`);
    }

    // Validate selected tools if specified
    if (selectedTools?.length) {
      await this.validateToolsetTools(toolset.key, selectedTools);
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
  private async validateToolsetTools(toolsetKey: string, selectedTools: string[]): Promise<void> {
    const toolset = await this.inventoryService.getInventoryItem(toolsetKey);
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

      if (toolset.type === ToolsetType.REGULAR) {
        importedToolset = await this.importRegularToolset(user, toolset);
      } else if (toolset.type === ToolsetType.MCP) {
        importedToolset = await this.importMcpToolset(user, toolset);
      } else if (toolset.type === ToolsetType.EXTERNAL_OAUTH) {
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

    // Check if toolset is config-based (doesn't need inventory check)
    // Config-based toolsets have authType='config_based' in the database
    const isConfigBased = toolsetInstance?.authType === AuthType.CONFIG_BASED;

    // Check if toolset key exists in inventory (skip for config_based)
    let toolsetDefinition = null;
    if (!isConfigBased) {
      toolsetDefinition = await this.inventoryService.getInventoryItem(key);
      if (!toolsetDefinition) {
        this.logger.warn(`Toolset key not found in inventory: ${key}, skipping`);
        return null;
      }
    }

    // Load inventory map for DTO functions
    const inventoryMap = await this.inventoryService.getInventoryMap();

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
        return toolsetPo2GenericToolset(validUserToolset, inventoryMap);
      }

      const validGlobalToolset = existingToolsets.find((t) => t.isGlobal && t.enabled);
      if (validGlobalToolset) {
        this.logger.debug(
          `Found existing regular global toolset for key ${key}, toolset id: ${validGlobalToolset.toolsetId}`,
        );
        return toolsetPo2GenericToolset(validGlobalToolset, inventoryMap);
      }

      // Return the first existing toolset if no valid user or global toolset is found
      return toolsetPo2GenericToolset(existingToolsets[0], inventoryMap);
    }

    // Create uninstalled toolset with pre-generated ID
    const toolsetId = genToolsetID();
    const toolsetName = await this.inventoryService.getNameByKey(key);

    const createdToolset = await this.prisma.toolset.create({
      data: {
        toolsetId,
        name: toolsetName,
        key,
        uid: user.uid,
        enabled: false, // Uninstalled toolsets are disabled
        uninstalled: true,
      },
    });

    this.logger.log(`Created uninstalled regular toolset: ${toolsetId} for key ${key}`);
    return toolsetPo2GenericToolset(createdToolset, inventoryMap);
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
    options?: {
      context?: SkillContext;
      canvasId?: string;
    },
  ): Promise<StructuredToolInterface[]> {
    const builtinKeys = toolsets
      .filter((t) => t.type === ToolsetType.REGULAR && t.builtin)
      .map((t) => t.id);
    let builtinTools: DynamicStructuredTool[] = [];
    if (builtinKeys.length > 0) {
      builtinTools = this.instantiateBuiltinToolsets(user, engine, builtinKeys);
    }

    let copilotTools: DynamicStructuredTool[] = [];
    if (toolsets.find((t) => t.type === ToolsetType.REGULAR && t.id === 'copilot')) {
      copilotTools = this.instantiateCopilotToolsets();
    }

    // Regular toolsets now include both regular and config_based (mapped to 'regular' type)
    const regularToolsets = toolsets.filter((t) => t.type === ToolsetType.REGULAR && !t.builtin);
    const mcpServers = toolsets.filter((t) => t.type === ToolsetType.MCP);

    const [regularTools, mcpTools, oauthToolsets] = await Promise.all([
      this.instantiateRegularToolsets(user, regularToolsets, engine, options),
      this.instantiateMcpServers(user, mcpServers),
      this.composioService.instantiateToolsets(user, toolsets, 'oauth'),
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
              type: ToolsetType.REGULAR,
              toolsetKey: tool.toolsetKey,
              toolsetName: tool.name,
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
    options?: {
      context?: SkillContext;
      canvasId?: string;
    },
  ): Promise<StructuredToolInterface[]> {
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

    // Separate legacy, config-based, and external API key toolsets
    const staticToolsets: typeof toolsetPOs = [];
    const configBasedToolsets: typeof toolsetPOs = [];
    const externalApiKeyToolsets: typeof toolsetPOs = [];
    for (const toolsetPO of toolsetPOs) {
      // Check if this is an external API key toolset (Composio API Key tools)
      if (toolsetPO.authType === 'external_apikey') {
        externalApiKeyToolsets.push(toolsetPO);
        continue;
      }
      // Check if this toolset is in staticToolsetInventory (legacy SDK-based tools, non-configurable)
      // toolsetInventory contains old hardcoded tools that are not configurable via database
      // All other tools are config-based and managed via toolset_inventory table
      const staticToolset = !!toolsetInventory[toolsetPO.key];
      if (staticToolset) {
        staticToolsets.push(toolsetPO);
      } else {
        configBasedToolsets.push(toolsetPO);
      }
    }

    // Legacy static toolsets (hardcoded, non-configurable)
    const staticTools = staticToolsets.flatMap((t) => {
      const toolset = toolsetInventory[t.key];
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
        context: options?.context, // Pass context for tools that need access to skill context
      });

      return toolset.definition.tools
        ?.map((tool) => toolsetInstance.getToolInstance(tool.name))
        .map(
          (tool) =>
            new DynamicStructuredTool({
              name: `${toolset.definition.key}_${tool.name}`,
              description: tool.description,
              schema: tool.schema,
              func: async (input, runManager, config: SkillRunnableConfig) => {
                const result = await tool.invoke(input);
                const isGlobal = t?.isGlobal ?? false;
                const creditCost = (result as any)?.creditCost ?? 0;
                const resultId = config.configurable.resultId;
                const version = config.configurable.version;
                if (isGlobal && result?.status !== 'error' && creditCost > 0) {
                  const jobData: SyncToolCreditUsageJobData = {
                    uid: user.uid,
                    originalPrice: creditCost,
                    discountedPrice: creditCost,
                    timestamp: new Date(),
                    toolCallId: runManager?.runId,
                    toolCallMeta: {
                      toolName: tool.name,
                      toolsetId: t.toolsetId,
                      toolsetKey: t.key,
                    },
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

    // Instantiate config-based tools via ToolFactory and Composio API Key toolsets in parallel
    const dynamicTools = (
      await Promise.all([
        this.instantiateDynamicToolsets(configBasedToolsets),
        this.composioService.instantiateToolsets(
          user,
          externalApiKeyToolsets.map((t) => ({
            id: t.toolsetId,
            name: t.name,
            type: 'regular' as const,
            toolset: {
              toolsetId: t.toolsetId,
              name: t.name,
              key: t.key,
            },
          })),
          'apikey',
        ),
      ])
    ).flat();

    this.logger.log(
      `Instantiated ${staticTools.length} static tools and ${dynamicTools.length} dynamic tools`,
    );

    return [...staticTools, ...dynamicTools];
  }

  /**
   * Instantiate config-based toolsets via ToolFactory
   * Credentials are automatically loaded from the toolset configuration
   */
  private async instantiateDynamicToolsets(
    toolsetPOs: Array<{
      key: string;
      name: string;
    }>,
  ): Promise<DynamicStructuredTool[]> {
    if (!toolsetPOs?.length) {
      return [];
    }
    const allTools: DynamicStructuredTool[] = [];
    for (const toolsetPO of toolsetPOs) {
      try {
        // Use ToolFactory to instantiate tools
        // Credentials are loaded automatically from the config
        const tools = await this.toolFactory.instantiateToolsByKey(toolsetPO.key);
        allTools.push(...tools);
      } catch (error) {
        this.logger.error(
          `Failed to instantiate config-based toolset ${toolsetPO.key}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
    return allTools;
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

  async getToolCallResult(user: User, toolCallId: string): Promise<ToolCallResult> {
    if (!toolCallId) {
      throw new ParamsError('Tool call ID is required');
    }

    const toolCallResult = await this.prisma.toolCallResult.findUnique({
      where: {
        callId: toolCallId,
        deletedAt: null,
      },
    });

    if (!toolCallResult) {
      throw new ParamsError(`Tool call result not found for callId: ${toolCallId}`);
    }

    // Verify user ownership
    if (toolCallResult.uid !== user.uid) {
      throw new ParamsError('Access denied: tool call result does not belong to current user');
    }

    // Convert to DTO format
    return {
      callId: toolCallResult.callId,
      uid: toolCallResult.uid,
      toolsetId: toolCallResult.toolsetId,
      toolName: toolCallResult.toolName,
      stepName: toolCallResult.stepName,
      input: safeParseJSON(toolCallResult.input || '{}'),
      output: safeParseJSON(toolCallResult.output || '{}'),
      error: toolCallResult.error || '',
      status: toolCallResult.status as 'executing' | 'completed' | 'failed',
      createdAt: toolCallResult.createdAt.getTime(),
      updatedAt: toolCallResult.updatedAt.getTime(),
      deletedAt: toolCallResult.deletedAt?.getTime(),
    };
  }
}
