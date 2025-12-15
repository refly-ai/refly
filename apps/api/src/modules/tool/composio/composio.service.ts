import { Composio, ToolExecuteResponse, AuthScheme } from '@composio/core';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import { DynamicStructuredTool, type StructuredToolInterface } from '@langchain/core/tools';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ComposioConnectedAccount,
  ComposioConnectionStatus,
  GenericToolset,
  ToolCreationContext,
  User,
  HandlerRequest,
} from '@refly/openapi-schema';
import { COMPOSIO_CONNECTION_STATUS } from '../constant/constant';
import { genToolsetID } from '@refly/utils';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import type { ComposioPostHandlerInput } from '../tool-execution/post-execution/post.interface';
import { ToolInventoryService } from '../inventory/inventory.service';
import { getCurrentUser, runInContext } from '../tool-context';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { SkillRunnableConfig } from '@refly/skill-template';
import { enhanceToolSchema } from '../utils/schema-utils';
import { ResourceHandler } from '../resource.service';
import { ComposioToolPostHandlerService } from '../tool-execution/post-execution/composio-post.service';

@Injectable()
export class ComposioService {
  private readonly logger = new Logger(ComposioService.name);
  private composio: Composio;
  private readonly DEFINITION_CACHE_PREFIX = 'oauth:definition:';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly composioPostHandler: ComposioToolPostHandlerService,
    private readonly inventoryService: ToolInventoryService,
    private readonly resourceHandler: ResourceHandler,
  ) {
    const apiKey = this.config.get<string>('composio.apiKey');
    if (!apiKey) {
      const message =
        'COMPOSIO_API_KEY is not configured. Set the environment variable to enable Composio integration.';
      this.logger.error(message);
    } else {
      this.composio = new Composio({ apiKey });
    }
  }

  /**
   * initiate OAuth connection
   */
  async authApp(user: User, appSlug: string) {
    try {
      this.logger.log(`Initiating connection for user ${user.uid}, app: ${appSlug}`);
      // use composio to authorize user with redirect URL
      const connectionRequest = await this.composio.toolkits.authorize(user.uid, appSlug);
      this.logger.log(`OAuth URL generated: ${connectionRequest.redirectUrl}`);

      return {
        redirectUrl: connectionRequest.redirectUrl,
        connectionRequestId: connectionRequest.id,
        app: appSlug,
      };
    } catch (error) {
      this.logger.error(`Failed to initiate connection: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * check connection status
   * If not found in DB, query Composio API directly to handle Webhook delays
   */
  async checkAppStatus(
    user: User,
    appSlug: string,
  ): Promise<{
    status: ComposioConnectionStatus;
    connectedAccountId?: string | null;
    integrationId: string;
  }> {
    try {
      // First check database
      const connection = await this.prisma.composioConnection.findFirst({
        where: {
          uid: user.uid,
          integrationId: appSlug,
          deletedAt: null,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (connection) {
        const status: ComposioConnectionStatus =
          connection.status === COMPOSIO_CONNECTION_STATUS.ACTIVE
            ? COMPOSIO_CONNECTION_STATUS.ACTIVE
            : COMPOSIO_CONNECTION_STATUS.REVOKED;
        return {
          status,
          connectedAccountId: connection.connectedAccountId ?? undefined,
          integrationId: connection.integrationId,
        };
      }

      // If not in DB, query Composio API directly
      const composioConnectionStatus = await this.refreshToolStatus(user, appSlug);
      if (composioConnectionStatus) {
        return composioConnectionStatus;
      }

      // Not found anywhere
      return {
        status: COMPOSIO_CONNECTION_STATUS.REVOKED,
        connectedAccountId: null,
        integrationId: appSlug,
      };
    } catch (error) {
      this.logger.error(`Connection status check failed: ${error.message}`);
      return {
        status: COMPOSIO_CONNECTION_STATUS.REVOKED,
        connectedAccountId: null,
        integrationId: appSlug,
      };
    }
  }

  /**
   * Revoke user connection and reset OAuth state
   * This will delete the connection from Composio and reset the database state
   */
  async revokeConnection(user: User, appSlug: string) {
    // Find the connection
    const connection = await this.prisma.composioConnection.findFirst({
      where: {
        uid: user.uid,
        integrationId: appSlug,
        deletedAt: null,
      },
    });

    if (!connection) {
      throw new NotFoundException(`Connection not found for app: ${appSlug}`);
    }

    // Try to revoke the connection in Composio (best effort)
    if (this.composio) {
      try {
        const result = await this.composio.connectedAccounts.delete(connection.connectedAccountId);
        if (!result.success) {
          this.logger.warn(
            `Composio connection revocation reported unsuccessful for user ${user.uid}, app: ${appSlug}`,
          );
        }
      } catch (composioError) {
        this.logger.warn(
          `Failed to revoke Composio connection, but will proceed with local cleanup: ${composioError.message}`,
        );
      }
    }

    // Delete the connection from database and update toolset table in a transaction
    await this.prisma.composioConnection.delete({
      where: { pk: connection.pk },
    });

    return {
      success: true,
      message: `Connection to ${appSlug} has been revoked successfully. You can reconnect at any time.`,
    };
  }

  /**
   * Fetch tools from Composio API
   * @param userId - The user ID (user.uid for OAuth, 'refly_global' for API Key tools)
   * @param integrationId - The integration/toolkit ID
   */
  async fetchTools(userId: string, integrationId: string): Promise<any[]> {
    const tools = await this.composio.tools.get(userId, {
      toolkits: [integrationId],
      limit: 100,
    });
    return tools;
  }
  /**
   * Execute a tool via toolName
   * @param userId - The user ID (user.uid for OAuth, 'refly_global' for API Key tools)
   * @param connectedAccountId - The connected account id
   * @param toolName - The tool name
   * @param input - The input arguments
   * @returns The tool execute response
   */
  async executeTool(
    userId: string,
    connectedAccountId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolExecuteResponse> {
    return await this.composio.tools.execute(toolName, {
      userId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: input,
    });
  }

  /**
   * Query Composio API directly to check connection status
   */
  private async refreshToolStatus(
    user: User,
    appSlug: string,
  ): Promise<{
    status: ComposioConnectionStatus;
    connectedAccountId: string;
    integrationId: string;
  } | null> {
    try {
      const connectedAccounts = await this.composio.connectedAccounts.list({
        userIds: [user.uid],
      });

      const connectedAccount = connectedAccounts.items?.find(
        (acc) => acc.toolkit?.slug?.toLowerCase() === appSlug.toLowerCase(),
      );

      if (connectedAccount && connectedAccount.status?.toUpperCase() === 'ACTIVE') {
        // Save connection and toolset in a single transaction
        await this.saveConnection(user, appSlug, connectedAccount);
        return {
          status: COMPOSIO_CONNECTION_STATUS.ACTIVE,
          connectedAccountId: connectedAccount.id,
          integrationId: appSlug,
        };
      }

      return null;
    } catch (composioError) {
      this.logger.warn(`Failed to query Composio API: ${composioError.message}`);
      return null;
    }
  }

  /**
   * Save or update Composio connection and toolset records in the database
   * Uses a transaction to guarantee data persistence for both tables
   */
  private async saveConnection(
    user: User,
    appSlug: string,
    connectedAccount: ComposioConnectedAccount,
  ) {
    const connectedAccountId = connectedAccount.id;
    const status: ComposioConnectionStatus =
      connectedAccount.status?.toUpperCase() === 'ACTIVE'
        ? COMPOSIO_CONNECTION_STATUS.ACTIVE
        : COMPOSIO_CONNECTION_STATUS.REVOKED;

    // Use transaction to ensure both composio_connection and toolset are saved atomically
    await this.prisma.$transaction(async (tx) => {
      // 1. Save or update composio_connections
      await tx.composioConnection.upsert({
        where: {
          uid_integrationId: {
            uid: user.uid,
            integrationId: appSlug,
          },
        },
        create: {
          uid: user.uid,
          integrationId: appSlug,
          connectedAccountId: connectedAccountId,
          status: status,
          metadata: JSON.stringify({}),
        },
        update: {
          connectedAccountId: connectedAccountId,
          status: status,
          metadata: JSON.stringify({}),
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

      // 2. Get toolset inventory info from InventoryService
      const inventoryItem = await this.inventoryService.getInventoryItem(appSlug);
      const toolsetName = (inventoryItem?.definition?.labelDict?.en as string) ?? appSlug;

      // 3. Find existing toolset (including soft-deleted ones for the same uid+key)
      const existingToolset = await tx.toolset.findFirst({
        where: {
          uid: user.uid,
          key: appSlug,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingToolset) {
        // Update existing toolset (reactivate if soft-deleted)
        await tx.toolset.update({
          where: { pk: existingToolset.pk },
          data: {
            enabled: status === COMPOSIO_CONNECTION_STATUS.ACTIVE,
            uninstalled: status !== COMPOSIO_CONNECTION_STATUS.ACTIVE,
            deletedAt: null, // Reactivate if it was soft-deleted
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new toolset
        await tx.toolset.create({
          data: {
            toolsetId: genToolsetID(),
            name: toolsetName,
            key: appSlug,
            authType: 'oauth',
            enabled: status === COMPOSIO_CONNECTION_STATUS.ACTIVE,
            uninstalled: false,
            uid: user.uid,
          },
        });
      }
    });
  }

  /**
   * Instantiate Composio toolsets into structured tools
   * Converts Composio tools into LangChain DynamicStructuredTool instances
   * @param user - The user requesting the tools
   * @param toolsets - Array of toolsets to instantiate
   * @param authType - Authentication type: 'oauth' (user-specific) or 'apikey' (global shared)
   */
  async instantiateToolsets(
    user: User,
    toolsets: GenericToolset[],
    authType: 'oauth' | 'apikey',
  ): Promise<StructuredToolInterface[]> {
    if (!toolsets?.length) {
      return [];
    }

    const structuredTools: StructuredToolInterface[] = [];
    for (const toolset of toolsets) {
      const integrationId = toolset.toolset?.key;
      if (!integrationId) {
        continue;
      }

      try {
        // Get connection info based on auth type
        let userId: string;
        let connectedAccountId: string;

        if (authType === 'oauth') {
          const connectionStatus = await this.checkAppStatus(user, integrationId);
          if (connectionStatus.status !== 'active') {
            continue;
          }
          userId = user.uid;
          connectedAccountId = connectionStatus.connectedAccountId ?? '';
        } else {
          // API Key: use global refly_global connection (lazy loading)
          connectedAccountId = await this.checkApiKeyStatus(integrationId);
          userId = 'refly_global';
        }

        // Get creditBilling from toolsetInventory (unified source), default to 3
        const inventory = await this.prisma.toolsetInventory.findUnique({
          where: { key: integrationId },
          select: {
            creditBilling: true,
            name: true,
          },
        });
        const creditCost = inventory?.creditBilling
          ? Number.parseFloat(inventory.creditBilling)
          : 3;

        // Fetch tools definition from Composio
        const tools = await this.fetchTools(userId, integrationId);

        // Create context for tool creation (user/userId comes from getCurrentUser() at runtime)
        const toolCreateContext: ToolCreationContext = {
          connectedAccountId,
          authType,
          creditCost,
          toolsetType: toolset.type,
          toolsetKey: toolset.toolset?.key ?? '',
          toolsetName: inventory?.name ?? toolset.name,
        };

        // Convert to LangChain DynamicStructuredTool
        const langchainTools = tools
          .filter((tool) => this.isToolValid(tool))
          .map((tool) => this.createStructuredTool(tool, toolCreateContext));

        structuredTools.push(...langchainTools);
      } catch (error) {
        this.logger.error(
          `Failed to instantiate ${authType} toolset ${integrationId}: ${error instanceof Error ? error.message : error}`,
        );
        // Continue with other toolsets even if one fails
      }
    }

    return structuredTools;
  }

  /**
   * Invalidate definition cache
   */
  async invalidateCache(appSlug: string): Promise<void> {
    const cacheKey = `${this.DEFINITION_CACHE_PREFIX}${appSlug}`;
    await this.redis.del(cacheKey);
    this.logger.log(`Invalidated definition cache for ${appSlug}`);
  }

  /**
   * Ensure auth config exists for a toolkit
   * Returns existing authConfigId from composio_connection.metadata or creates a new one
   */
  async ensureAuthConfig(integrationId: string): Promise<string> {
    // Check if authConfigId already exists in composio_connection metadata
    const existingConnection = await this.prisma.composioConnection.findFirst({
      where: {
        uid: 'refly_global',
        integrationId,
        deletedAt: null,
      },
    });

    if (existingConnection?.metadata) {
      try {
        const metadata = JSON.parse(existingConnection.metadata);
        if (metadata.authConfigId) {
          this.logger.log(`Auth config exists for ${integrationId}: ${metadata.authConfigId}`);
          return metadata.authConfigId;
        }
      } catch {
        // Invalid metadata, continue to create new auth config
      }
    }

    // Create new auth config via Composio API
    this.logger.log(`Creating auth config for ${integrationId}`);

    try {
      const authConfig = await this.composio.authConfigs.create(integrationId, {
        type: 'use_custom_auth',
        authScheme: 'API_KEY',
        credentials: {},
      });

      this.logger.log(`Auth config created for ${integrationId}: ${authConfig.id}`);
      return authConfig.id;
    } catch (error) {
      this.logger.error(`Failed to create auth config for ${integrationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup global API key authentication for a toolkit
   */
  async setupGlobalApiKeyAuth(integrationId: string, apiKey: string): Promise<string> {
    // Ensure auth config exists
    const authConfigId = await this.ensureAuthConfig(integrationId);
    // Create connected account using initiate method
    this.logger.log(`Setting up global API key auth for ${integrationId}`);

    try {
      // Determine which API key field to use based on integration
      const integrationIdLower = integrationId.toLowerCase();
      const useGenericApiKey =
        integrationIdLower === 'alpha_vantage' || integrationIdLower === 'hunter';

      const apiKeyConfig = useGenericApiKey ? { generic_api_key: apiKey } : { api_key: apiKey };

      const connectionRequest = await this.composio.connectedAccounts.initiate(
        'refly_global', // Fixed userId for global tools
        authConfigId,
        {
          config: AuthScheme.APIKey(apiKeyConfig),
        },
      );

      // Save to composio_connection table
      await this.prisma.composioConnection.create({
        data: {
          uid: 'refly_global',
          integrationId,
          connectedAccountId: connectionRequest.id,
          status: connectionRequest.status || 'active',
          metadata: JSON.stringify({
            authConfigId,
            createdAt: new Date().toISOString(),
          }),
        },
      });

      this.logger.log(
        `Global API key tool registered: ${integrationId} -> ${connectionRequest.id}`,
      );

      return connectionRequest.id;
    } catch (error) {
      this.logger.error(`Failed to setup global API key auth: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure global API key connection exists (lazy loading)
   * Called when tool is about to be used
   */
  async checkApiKeyStatus(integrationId: string): Promise<string> {
    // Check if connection already exists
    const existing = await this.prisma.composioConnection.findFirst({
      where: {
        uid: 'refly_global',
        integrationId,
        deletedAt: null,
      },
    });

    if (existing) {
      this.logger.log(`Connection exists for ${integrationId}: ${existing.connectedAccountId}`);
      return existing.connectedAccountId;
    }

    // Get API key from inventory
    const inventory = await this.prisma.toolsetInventory.findUnique({
      where: { key: integrationId },
    });

    if (!inventory) {
      throw new Error(`Toolset not found in inventory: ${integrationId}`);
    }

    if (!inventory.apiKey) {
      throw new Error(`No API key configured for ${integrationId}`);
    }

    // Setup new connection
    this.logger.log(`Creating new connection for ${integrationId}`);
    return await this.setupGlobalApiKeyAuth(integrationId, inventory.apiKey);
  }

  /**
   * Check if a tool should be included (not deprecated)
   * @param tool - Composio tool definition
   * @returns true if the tool should be included
   */
  private isToolValid(tool: {
    function?: { name?: string; description?: string; parameters?: Record<string, any> };
    description?: string;
  }): boolean {
    const fn = tool?.function;
    if (!fn?.name) return false;

    // Skip deprecated tools
    const description = fn?.description ?? tool?.description ?? '';
    if (/deprecated/i.test(description)) {
      return false;
    }

    // Skip tools with deprecated properties
    const params = (fn.parameters ?? {}) as Record<string, any>;
    const properties = params?.properties ?? {};
    const hasDeprecatedProps = Object.values(properties).some(
      (prop: any) => prop?.deprecated === true,
    );

    return !hasDeprecatedProps;
  }

  /**
   * Create a DynamicStructuredTool from Composio tool definition
   */
  private createStructuredTool(
    tool: { function?: { name?: string; description?: string; parameters?: Record<string, any> } },
    context: ToolCreationContext,
  ): DynamicStructuredTool {
    const fn = tool.function;
    const toolName = fn?.name ?? 'unknown_tool';

    // Enhance schema: mark URL fields as resources, add file_name_title field, and guide LLM
    const enhancedSchema = enhanceToolSchema((fn?.parameters ?? {}) as any);
    // Convert to Zod schema (enhanced descriptions will be preserved)
    const toolSchema: any = JSONSchemaToZod.convert(enhancedSchema);

    return new DynamicStructuredTool({
      name: toolName,
      description:
        fn?.description ??
        `${context.authType === 'oauth' ? 'OAuth' : 'API Key'} tool: ${toolName}`,
      schema: toolSchema,
      func: async (
        input: Record<string, unknown>,
        _runManager: unknown,
        runnableConfig: RunnableConfig,
      ) => {
        try {
          const inputRecord = input as Record<string, unknown>;

          // Extract file_name_title before calling Composio API (it's not part of the actual schema)
          const { file_name_title, ...toolInput } = inputRecord;

          // Run tool execution within context (similar to dynamic-tooling)
          const { result, user, resultId, version, canvasId } = await runInContext(
            {
              langchainConfig: runnableConfig as SkillRunnableConfig,
              requestId: `composio-${toolName}-${Date.now()}`,
            },
            async () => {
              // Capture user inside context before it's gone
              const currentUser = getCurrentUser();
              // Convert fileIds to URLs using ResourceHandler
              const processedRequest = await this.resourceHandler.resolveInputResources(
                { params: toolInput } as HandlerRequest,
                enhancedSchema,
              );

              // For OAuth tools, use current user's uid; for API Key tools, use 'refly_global'
              const userId = context.authType === 'oauth' ? currentUser?.uid : 'refly_global';
              const executionResult = await this.executeTool(
                userId,
                context.connectedAccountId,
                toolName,
                processedRequest.params,
              );
              return {
                result: executionResult,
                user: currentUser,
                resultId: runnableConfig?.configurable?.resultId as string | undefined,
                version: runnableConfig?.configurable?.version as number | undefined,
                canvasId: runnableConfig?.configurable?.canvasId as string | undefined,
              };
            },
          );

          // Use composioPostHandler for billing and result compression
          const postHandlerInput: ComposioPostHandlerInput = {
            toolName,
            toolsetKey: context.toolsetKey,
            rawResult: result,
            creditCost: context.creditCost,
            toolsetName: context.toolsetName,
            fileNameTitle: (file_name_title as string) || 'untitled',
            context: {
              user,
              resultId,
              resultVersion: version,
              canvasId,
            },
          };

          const postResult = await this.composioPostHandler.process(postHandlerInput);

          if (result?.successful) {
            return postResult.content;
          }
          return JSON.stringify({
            error: result?.error ?? 'Unknown Composio execution error',
          });
        } catch (error) {
          this.logger.error(
            `Failed to execute ${context.authType} tool ${toolName}: ${error instanceof Error ? error.message : error}`,
          );
          return JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      metadata: {
        name: toolName,
        type: context.toolsetType,
        toolsetKey: context.toolsetKey,
        toolsetName: context.toolsetName,
      },
    });
  }
}
