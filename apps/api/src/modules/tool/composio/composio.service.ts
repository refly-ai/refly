import { Composio, ToolExecuteResponse } from '@composio/core';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import { DynamicStructuredTool, type StructuredToolInterface } from '@langchain/core/tools';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ComposioConnectionStatus,
  GenericToolset,
  ToolsetDefinition,
  User,
} from '@refly/openapi-schema';
import { Queue } from 'bullmq';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../../utils/const';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { CreditService } from '../../credit/credit.service';
import type { SyncToolCreditUsageJobData } from '../../credit/credit.dto';
import type { OAuthToolsetConfig } from './composio.types';

@Injectable()
export class ComposioService {
  private readonly logger = new Logger(ComposioService.name);
  private composio: Composio;
  private readonly DEFINITION_CACHE_TTL = 60 * 60 * 24; // 24 hours
  private readonly DEFINITION_CACHE_PREFIX = 'oauth:definition:';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly creditService: CreditService,
    @Optional()
    @InjectQueue(QUEUE_SYNC_TOOL_CREDIT_USAGE)
    private readonly toolCreditUsageQueue?: Queue<SyncToolCreditUsageJobData>,
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
          connection.status === 'active' ? 'active' : 'revoked';
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
        status: 'revoked' as const,
        connectedAccountId: null,
        integrationId: appSlug,
      };
    } catch (error) {
      this.logger.error(`Connection status check failed: ${error.message}`);
      return {
        status: 'revoked' as const,
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
   * Fetch OAuth tools from Composio API
   * @param user - The user object
   * @param appSlug - The app slug
   * @returns
   */
  async fetchOAuthTools(user: User, appSlug: string): Promise<any[]> {
    const tools = await this.composio.tools.get(user.uid, {
      toolkits: [appSlug],
      limit: 50,
    });
    return tools;
  }
  /**
   * Execute a tool via toolName
   * @param user - The user objectoc
   * @param connectedAccountId - The connected account id
   * @param toolName - The tool name
   * @param input - The input arguments
   * @returns The tool execute response
   */
  async executeTool(
    user: User,
    connectedAccountId: string,
    toolName: string,
    input: any,
  ): Promise<ToolExecuteResponse> {
    return await this.composio.tools.execute(toolName, {
      userId: user.uid,
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
          status: 'active' as const,
          connectedAccountId: connectedAccount.id,
          integrationId: appSlug,
        };
      }

      return null;
    } catch (composioError) {
      this.logger.warn('Failed to query Composio API: ', composioError.message);
      return null;
    }
  }

  /**
   * Save or update Composio connection record in the database
   * This manages both composio_connections and toolsets tables
   */
  private async saveConnection(user: User, appSlug: string, connectedAccount: any) {
    const connectedAccountId = connectedAccount.id;
    const status: ComposioConnectionStatus =
      connectedAccount.status?.toUpperCase() === 'ACTIVE' ? 'active' : 'revoked';

    // 1. Fetch definition from Composio (with caching)
    const definition = await this.getDefinition(appSlug);

    // 2. Build OAuth config
    const oauthConfig: OAuthToolsetConfig = {
      integrationId: appSlug,
      connectedAccountId,
      ...(definition && {
        definition,
        lastDefinitionSync: new Date().toISOString(),
      }),
    };

    // 3. Save or update composio_connections
    await this.prisma.composioConnection.upsert({
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

    // 4. Create or update toolset with definition in config
    const existingToolset = await this.prisma.toolset.findFirst({
      where: {
        uid: user.uid,
        key: appSlug,
        authType: 'oauth',
      },
    });

    if (existingToolset) {
      // Update existing toolset
      await this.prisma.toolset.update({
        where: { pk: existingToolset.pk },
        data: {
          enabled: true,
          uninstalled: false,
          deletedAt: null,
          config: JSON.stringify(oauthConfig),
          updatedAt: new Date(),
        },
      });
      this.logger.log(`OAuth toolset updated with definition: ${appSlug}`);
    } else {
      // Create new toolset
      await this.prisma.toolset.create({
        data: {
          toolsetId: this.generateToolsetId(),
          uid: user.uid,
          key: appSlug,
          name: (definition?.labelDict?.en as string) || appSlug,
          authType: 'oauth',
          enabled: true,
          isGlobal: false,
          config: JSON.stringify(oauthConfig),
        },
      });
      this.logger.log(`OAuth toolset created with definition: ${appSlug}`);
    }
  }

  /**
   * Generate a unique toolset ID
   */
  private generateToolsetId(): string {
    return `toolset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Instantiate OAuth toolsets into structured tools
   * Converts Composio OAuth tools into LangChain DynamicStructuredTool instances
   */
  async instantiateOAuthToolsets(
    user: User,
    toolsets: GenericToolset[],
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

      const connectionStatus = await this.checkAppStatus(user, integrationId);
      if (connectionStatus.status !== 'active') {
        continue;
      }

      // Query toolset from database to get creditBilling
      const toolsetPO = await this.prisma.toolset.findFirst({
        where: {
          key: integrationId,
          uid: user.uid,
          authType: 'oauth',
          deletedAt: null,
        },
        select: {
          creditBilling: true,
          name: true,
        },
      });

      // Parse creditBilling from database (stored as a number string)
      const creditCost = toolsetPO?.creditBilling ? Number.parseFloat(toolsetPO.creditBilling) : 0;

      const tools = await this.fetchOAuthTools(user, integrationId);
      // Convert to LangChain DynamicStructuredTool
      const langchainTools = tools
        .filter((tool) => {
          const fn = tool?.function;
          if (!fn?.name) return false;
          // Skip deprecated tools
          const description = fn?.description ?? tool?.description ?? '';
          if (/deprecated/i.test(description)) {
            return false;
          }
          const params = (fn.parameters ?? {}) as Record<string, any>;
          const properties = params?.properties ?? {};
          const deprecatedProps = Object.keys(properties)
            .map((key) => (properties[key]?.deprecated ? key : null))
            .filter(Boolean);
          return deprecatedProps.length === 0;
        })
        .map((tool) => {
          const fn = tool.function;
          const toolName = fn?.name ?? 'unknown_tool';
          const toolSchema = JSONSchemaToZod.convert(fn.parameters ?? {}) as any;
          return new DynamicStructuredTool({
            name: toolName,
            description: fn?.description ?? `OAuth tool: ${toolName}`,
            schema: toolSchema,
            func: async (input: unknown) => {
              try {
                const result = await this.executeTool(
                  user,
                  connectionStatus.connectedAccountId ?? '',
                  toolName,
                  input,
                );
                if (result?.successful) {
                  // Add credit billing logic after successful execution
                  if (creditCost > 0) {
                    const jobData: SyncToolCreditUsageJobData = {
                      uid: user.uid,
                      creditCost: creditCost,
                      timestamp: new Date(),
                      toolsetName: toolsetPO?.name ?? toolset.name,
                      toolName: toolName,
                    };
                    await this.creditService.syncToolCreditUsage(jobData);
                  }
                  return JSON.stringify(result.data ?? null);
                }
                return JSON.stringify({
                  error: result?.error ?? 'Unknown Composio execution error',
                });
              } catch (error) {
                this.logger.error(
                  `Failed to execute Composio tool ${toolName}: ${error instanceof Error ? error.message : error}`,
                );
                return JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            },
            metadata: {
              name: toolName,
              type: toolset.type,
              toolsetKey: toolset.toolset?.key,
              toolsetName: toolset.name,
            },
          });
        });

      structuredTools.push(...langchainTools);
    }
    return structuredTools;
  }

  /**
   * Fetch OAuth integration definition from Composio API
   * Returns definition metadata (name, description, icon, tools list)
   */
  async fetchDefinition(appSlug: string, domain?: string): Promise<ToolsetDefinition | null> {
    try {
      // If domain not provided, try to get from database
      let toolsetDomain = domain;
      if (!toolsetDomain) {
        const toolset = await this.prisma.toolset.findFirst({
          where: {
            key: appSlug,
            authType: 'oauth',
            deletedAt: null,
          },
          select: {
            domain: true,
          },
        });
        toolsetDomain = toolset?.domain || appSlug;
      }

      // Fetch tools for this integration
      const tools = await this.composio.tools.get('system', {
        toolkits: [appSlug],
        limit: 100,
      });

      if (!tools || tools.length === 0) {
        this.logger.warn(`No tools found for integration: ${appSlug}`);
        return null;
      }

      // Extract toolkit metadata from first tool (tools are in OpenAI function format)
      const firstTool = tools[0] as any;
      const toolkit = firstTool?.toolkit;
      const toolkitName = toolkit?.name || appSlug;
      const toolkitDesc = toolkit?.description || '';

      // Build ToolsetDefinition from Composio data
      const definition: ToolsetDefinition = {
        key: appSlug,
        domain: toolsetDomain,
        labelDict: {
          en: toolkitName,
          zh: toolkitName,
        },
        descriptionDict: {
          en: toolkitDesc || `${toolkitName} integration`,
          zh: toolkitDesc || `${toolkitName} 集成`,
        },
        requiresAuth: true,
        tools: tools.map((tool: any) => {
          const fn = tool?.function || {};
          return {
            name: fn.name || 'unknown',
            descriptionDict: {
              en: fn.description || '',
              zh: fn.description || '',
            },
            category: this.inferCategory(fn),
          };
        }),
      };

      return definition;
    } catch (error) {
      this.logger.error(`Failed to fetch definition for ${appSlug}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Get OAuth integration definition with caching
   * Priority: Redis Cache > Toolset Config > Composio API
   */
  async getDefinition(appSlug: string): Promise<ToolsetDefinition | null> {
    const cacheKey = `${this.DEFINITION_CACHE_PREFIX}${appSlug}`;

    try {
      // 1. Try Redis cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Definition cache hit for ${appSlug}`);
        return JSON.parse(cached);
      }

      // 2. Try from any toolset's config field
      const toolset = await this.prisma.toolset.findFirst({
        where: {
          key: appSlug,
          authType: 'oauth',
          deletedAt: null,
        },
        select: {
          config: true,
        },
      });

      if (toolset?.config) {
        const config: OAuthToolsetConfig = JSON.parse(toolset.config);
        if (config?.definition) {
          // Update cache
          await this.redis.setex(
            cacheKey,
            this.DEFINITION_CACHE_TTL,
            JSON.stringify(config.definition),
          );
          this.logger.debug(`Definition loaded from config for ${appSlug}`);
          return config.definition;
        }
      }

      // 3. Fetch from Composio API
      const definition = await this.fetchDefinition(appSlug);
      if (definition) {
        // Save to cache
        await this.redis.setex(cacheKey, this.DEFINITION_CACHE_TTL, JSON.stringify(definition));
        this.logger.log(`Definition fetched from Composio API for ${appSlug}`);
        return definition;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get definition for ${appSlug}: ${(error as Error).message}`);
      return null;
    }
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
   * Get default icon URL for known apps
   */
  private getDefaultIcon(appSlug: string): string {
    const iconMap: Record<string, string> = {
      'google-drive': '/icons/google-drive.svg',
      'google-docs': '/icons/google-docs.svg',
      'google-sheets': '/icons/google-sheets.svg',
      gmail: '/icons/gmail.svg',
      github: '/icons/github.svg',
      twitter: '/icons/twitter.svg',
      notion: '/icons/notion.svg',
      reddit: '/icons/reddit.svg',
    };

    return iconMap[appSlug] || '/icons/oauth-default.svg';
  }

  /**
   * Infer tool category from tool metadata
   */
  private inferCategory(tool: any): string {
    const name = tool.name?.toLowerCase() || '';
    const description = tool.description?.toLowerCase() || '';

    if (name.includes('search') || description.includes('search')) {
      return 'search';
    }
    if (name.includes('file') || name.includes('document')) {
      return 'document';
    }
    if (name.includes('mail') || name.includes('email')) {
      return 'communication';
    }
    if (name.includes('calendar') || name.includes('event')) {
      return 'productivity';
    }

    return 'general';
  }
}
