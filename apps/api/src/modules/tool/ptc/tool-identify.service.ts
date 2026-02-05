/**
 * Tool Identify Service
 * Identifies tool type based on toolset key for routing to appropriate executor or definition extractor.
 * Extracted from ToolExecutionService for reuse across execution and definition services.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@refly/openapi-schema';
import { ParamsError, ToolsetNotFoundError } from '@refly/errors';
import { PrismaService } from '../../common/prisma.service';
import { ComposioService } from '../composio/composio.service';
import { ToolInventoryService } from '../inventory/inventory.service';
import { builtinToolsetInventory } from '@refly/agent-tools';

/**
 * Tool type enumeration for internal routing
 * Includes unsupported types (mcp, builtin) for explicit error handling
 */
export type ToolExecutionType =
  | 'mcp'
  | 'composio_oauth'
  | 'composio_apikey'
  | 'config_based'
  | 'legacy_sdk'
  | 'builtin';

/**
 * Tool identification result
 */
export interface ToolIdentification {
  type: ToolExecutionType;
  toolsetKey: string;
  connectedAccountId?: string;
  userId?: string;
}

@Injectable()
export class ToolIdentifyService {
  private readonly logger = new Logger(ToolIdentifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly composioService: ComposioService,
    private readonly inventoryService: ToolInventoryService,
  ) {}

  /**
   * Identify tool type based on toolset key
   *
   * Classification logic:
   * 1. Check builtin tools first → builtin (not supported)
   * 2. Check mcp_server table → MCP (not supported)
   * 3. Check toolset table (instance layer):
   *    - auth_type = oauth → composio_oauth
   *    - auth_type = external_apikey → composio_apikey
   *    - auth_type = config_based/credentials → go to step 4
   * 4. Compare toolset.key with static inventory:
   *    - Has class → legacy_sdk
   *    - Otherwise → config_based
   *
   * @param user - The user executing the tool
   * @param toolsetKey - The toolset key
   * @returns Tool identification with type and connection info
   */
  async identifyTool(user: User, toolsetKey: string): Promise<ToolIdentification> {
    // Step 1: Check if it's a builtin tool first
    // Builtin tools exist only in static inventory without database records
    if (builtinToolsetInventory[toolsetKey]) {
      return {
        type: 'builtin',
        toolsetKey,
      };
    }

    // Step 2: Check mcp_server table (MCP tools are not supported via API)
    const mcpServer = await this.prisma.mcpServer.findFirst({
      where: {
        uid: user.uid,
        name: toolsetKey,
        enabled: true,
        deletedAt: null,
      },
    });

    if (mcpServer) {
      return {
        type: 'mcp',
        toolsetKey,
      };
    }

    // Step 3: Query toolset table (instance layer) for user-specific or global toolset
    const toolset = await this.prisma.toolset.findFirst({
      where: {
        key: toolsetKey,
        enabled: true,
        deletedAt: null,
        uninstalled: false,
        OR: [{ uid: user.uid }, { isGlobal: true }],
      },
      // Prefer user-specific toolset over global
      orderBy: { isGlobal: 'asc' },
    });

    if (toolset) {
      // Step 3.1: Route based on auth_type field (primary classification)

      // OAuth → composio_oauth (requires active Composio connection)
      if (toolset.authType === 'oauth') {
        const connection = await this.prisma.composioConnection.findFirst({
          where: {
            uid: user.uid,
            integrationId: toolsetKey,
            status: 'active',
            deletedAt: null,
          },
        });

        if (!connection?.connectedAccountId) {
          throw new ParamsError(`OAuth connection not authorized for toolset: ${toolsetKey}`);
        }

        return {
          type: 'composio_oauth',
          toolsetKey,
          connectedAccountId: connection.connectedAccountId,
          userId: user.uid,
        };
      }

      // External API Key → composio_apikey (global Composio tools with system API keys)
      if (toolset.authType === 'external_apikey') {
        const connectedAccountId = await this.composioService.checkApiKeyStatus(toolsetKey);

        return {
          type: 'composio_apikey',
          toolsetKey,
          connectedAccountId,
          userId: 'refly_global',
        };
      }

      // Step 4: For config_based/credentials auth types, distinguish legacy SDK vs config-based
      // Check if toolset key exists in static inventory with a class definition
      const inventoryItem = await this.inventoryService.getInventoryItem(toolsetKey);

      // If key has a class in static inventory → legacy_sdk (hardcoded SDK-based tools)
      if (inventoryItem?.class) {
        return {
          type: 'legacy_sdk',
          toolsetKey,
        };
      }

      // Otherwise → config_based (database-driven dynamic tools)
      return {
        type: 'config_based',
        toolsetKey,
      };
    }

    // No record found anywhere
    throw new ToolsetNotFoundError(`Toolset not found: ${toolsetKey}`);
  }

  /**
   * Identify tool type without requiring user authentication.
   * Used for schema export where we only need to determine tool type.
   * Does not validate OAuth connections or user-specific access.
   * Supports both global and user-specific toolsets.
   *
   * @param toolsetKey - The toolset key
   * @returns Tool identification with type (without connection info)
   */
  async identifyToolType(toolsetKey: string): Promise<ToolIdentification> {
    // Step 1: Check if it's a builtin tool first
    if (builtinToolsetInventory[toolsetKey]) {
      return {
        type: 'builtin',
        toolsetKey,
      };
    }

    // Step 2: Check toolset_inventory for type information
    const inventory = await this.prisma.toolsetInventory.findFirst({
      where: {
        key: toolsetKey,
        enabled: true,
        deletedAt: null,
      },
    });

    if (inventory) {
      // Determine type based on inventory type field
      if (inventory.type === 'external_oauth') {
        return {
          type: 'composio_oauth',
          toolsetKey,
        };
      }

      if (inventory.type === 'external_apikey') {
        return {
          type: 'composio_apikey',
          toolsetKey,
        };
      }

      // Check if it has a class in static inventory
      const inventoryItem = await this.inventoryService.getInventoryItem(toolsetKey);
      if (inventoryItem?.class) {
        return {
          type: 'legacy_sdk',
          toolsetKey,
        };
      }

      // Default to config_based
      return {
        type: 'config_based',
        toolsetKey,
      };
    }

    // Step 3: Check toolset table (both global and user-specific)
    // For schema export, we don't restrict to global only
    const toolset = await this.prisma.toolset.findFirst({
      where: {
        key: toolsetKey,
        enabled: true,
        deletedAt: null,
        uninstalled: false,
      },
      // Prefer global toolset over user-specific for consistency
      orderBy: { isGlobal: 'desc' },
    });

    if (toolset) {
      if (toolset.authType === 'oauth') {
        return {
          type: 'composio_oauth',
          toolsetKey,
        };
      }

      if (toolset.authType === 'external_apikey') {
        return {
          type: 'composio_apikey',
          toolsetKey,
        };
      }

      // Check static inventory for legacy SDK
      const inventoryItem = await this.inventoryService.getInventoryItem(toolsetKey);
      if (inventoryItem?.class) {
        return {
          type: 'legacy_sdk',
          toolsetKey,
        };
      }

      return {
        type: 'config_based',
        toolsetKey,
      };
    }

    // Step 4: Fallback to static inventory if no database records found
    // This handles tools registered in code but not yet in database
    const inventoryItem = await this.inventoryService.getInventoryItem(toolsetKey);

    if (inventoryItem) {
      // If it has a class definition → legacy_sdk
      if (inventoryItem.class) {
        return {
          type: 'legacy_sdk',
          toolsetKey,
        };
      }

      // If it has a definition without class → determine from authPatterns
      if (inventoryItem.definition) {
        const { authPatterns, type } = inventoryItem.definition;

        // Check authPatterns for OAuth tools
        if (authPatterns && authPatterns.length > 0) {
          const authType = authPatterns[0]?.type;
          if (authType === 'oauth') {
            return {
              type: 'composio_oauth',
              toolsetKey,
            };
          }
          // Could add support for other auth types here if needed
        }

        // Check definition.type for external tools
        if (type === 'external_oauth') {
          return {
            type: 'composio_oauth',
            toolsetKey,
          };
        }

        // Default to config_based for other types
        return {
          type: 'config_based',
          toolsetKey,
        };
      }
    }

    // No record found anywhere (neither database nor static inventory)
    throw new ToolsetNotFoundError(`Toolset not found: ${toolsetKey}`);
  }
}
