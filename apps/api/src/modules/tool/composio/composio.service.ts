import { Composio, ToolExecuteResponse } from '@composio/core';
import { DynamicStructuredTool, type StructuredToolInterface } from '@langchain/core/tools';
import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ComposioConnectionStatus, GenericToolset, User } from '@refly/openapi-schema';
import { PrismaService } from '../../common/prisma.service';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../../utils/const';
import { SyncToolCreditUsageJobData } from '../../credit/credit.dto';

@Injectable()
export class ComposioService {
  private readonly logger = new Logger(ComposioService.name);
  private composio: Composio;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(QUEUE_SYNC_TOOL_CREDIT_USAGE)
    private readonly toolCreditUsageQueue?: Queue<SyncToolCreditUsageJobData>,
  ) {
    const apiKey = this.config.get<string>('composio.apiKey');
    if (!apiKey) {
      const message =
        'COMPOSIO_API_KEY is not configured. Set the environment variable to enable Composio integration.';
      this.logger.error(message);
    }
    this.composio = new Composio({ apiKey });
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
   * This only manages the composio_connections table
   */
  private async saveConnection(user: User, appSlug: string, connectedAccount: any) {
    const connectedAccountId = connectedAccount.id;
    const status: ComposioConnectionStatus =
      connectedAccount.status?.toUpperCase() === 'ACTIVE' ? 'active' : 'revoked';

    // 1. Save or update composio_connections
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
        .filter((tool) => tool?.function?.name) // Filter out invalid tools
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
                  if (creditCost > 0 && this.toolCreditUsageQueue) {
                    const jobData: SyncToolCreditUsageJobData = {
                      uid: user.uid,
                      creditCost: creditCost,
                      timestamp: new Date(),
                      toolsetName: toolsetPO?.name ?? toolset.name,
                      toolName: toolName,
                    };
                    await this.toolCreditUsageQueue.add(
                      `tool_credit_usage:${user.uid}:${integrationId}:${toolName}`,
                      jobData,
                    );
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
}
