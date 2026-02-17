/**
 * Tool Definition Service
 * Provides unified schema export for all tool types (Composio, Config-based, Legacy SDK).
 * Used for generating Python SDK.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  ToolsetExportDefinition,
  ToolExportDefinition,
  JsonSchema,
} from '@refly/openapi-schema';
import { ParamsError, ToolsetNotFoundError } from '@refly/errors';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ComposioService } from '../composio/composio.service';
import { ToolInventoryService } from '../inventory/inventory.service';
import { ToolIdentifyService } from './tool-identify.service';
import { PrismaService } from '../../common/prisma.service';
import { addFileNameTitleField } from '../utils/schema-utils';

@Injectable()
export class ToolDefinitionService {
  private readonly logger = new Logger(ToolDefinitionService.name);

  constructor(
    private readonly composioService: ComposioService,
    private readonly inventoryService: ToolInventoryService,
    private readonly toolIdentifyService: ToolIdentifyService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Export tool definitions for specified toolset keys.
   * Returns the original schema without model-specific optimizations.
   * This is an internal API for generating Python SDK, no user-specific permission checks needed.
   *
   * @param toolsetKeys - Optional comma-separated toolset keys to export. If not provided, exports all supported toolsets.
   * @returns Array of toolset export definitions
   */
  async exportToolsetDefinitions(toolsetKeys?: string): Promise<ToolsetExportDefinition[]> {
    let keys: string[];

    // If no toolsetKeys provided, get all supported toolsets
    if (!toolsetKeys?.trim()) {
      keys = await this.getAllSupportedToolsetKeys();
      this.logger.log(`Exporting all supported toolsets: ${keys.join(', ')}`);
    } else {
      // Parse comma-separated keys
      keys = toolsetKeys
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      if (keys.length === 0) {
        throw new ParamsError('At least one valid toolsetKey is required');
      }
    }

    const results: ToolsetExportDefinition[] = [];

    // Process each toolset key - fail all if any fails
    for (const toolsetKey of keys) {
      const definition = await this.exportSingleToolset(toolsetKey);
      results.push(definition);
    }

    return results;
  }

  /**
   * Get all supported toolset keys from both toolset_inventory and toolset tables.
   * Returns toolsets that can be exported: Composio, Config-based, and Legacy SDK.
   * Filters out MCP and Builtin tools (these have separate protocols).
   *
   * @returns Array of unique toolset keys
   */
  private async getAllSupportedToolsetKeys(): Promise<string[]> {
    const supportedKeys = new Set<string>();

    // Step 1: Query toolset_inventory table for definition-level toolsets
    const inventoryItems = await this.prisma.toolsetInventory.findMany({
      where: {
        enabled: true,
        deletedAt: null,
      },
      select: {
        key: true,
        type: true,
      },
      orderBy: {
        key: 'asc',
      },
    });

    // Get static inventory items to check for class definitions
    const _staticInventoryMap = await this.inventoryService.getInventoryMap();

    // Filter to only supported types from toolset_inventory
    for (const item of inventoryItems) {
      // Support Composio OAuth and API Key tools
      if (item.type === 'external_oauth' || item.type === 'external_apikey') {
        supportedKeys.add(item.key);
        continue;
      }

      // Support Config-based tools and Legacy SDK tools
      // Config-based: no class in static inventory (uses DB-driven config)
      // Legacy SDK: has class in static inventory (uses TypeScript Zod schemas)
      supportedKeys.add(item.key);
    }

    // Step 2: Query toolset table for instance-level toolsets
    // Some toolsets (like github) may only exist in the toolset table
    const toolsets = await this.prisma.toolset.findMany({
      where: {
        enabled: true,
        deletedAt: null,
        uninstalled: false,
      },
      select: {
        key: true,
        authType: true,
      },
      distinct: ['key'],
    });

    // Get all keys from toolset_inventory for validation
    const inventoryKeySet = new Set(inventoryItems.map((item) => item.key));

    // Add Composio OAuth and API Key tools from toolset table
    for (const toolset of toolsets) {
      // Skip if already added from toolset_inventory
      if (supportedKeys.has(toolset.key)) {
        continue;
      }

      // Support Composio OAuth and API Key tools
      // These can exist in toolset table only (e.g., github)
      if (toolset.authType === 'oauth' || toolset.authType === 'external_apikey') {
        supportedKeys.add(toolset.key);
        continue;
      }

      // For config_based/credentials auth types:
      // - Must exist in toolset_inventory to be a valid tool
      // - Supports both Config-based (no class) and Legacy SDK (has class)
      if (inventoryKeySet.has(toolset.key)) {
        supportedKeys.add(toolset.key);
      }
      // If not in toolset_inventory, skip it (incomplete configuration)
    }

    return Array.from(supportedKeys).sort();
  }

  /**
   * Export a single toolset's definition
   * No user context needed - this is for internal schema export only
   *
   * @param toolsetKey - The toolset key to export
   * @returns Toolset export definition
   */
  private async exportSingleToolset(toolsetKey: string): Promise<ToolsetExportDefinition> {
    // Identify tool type without user context (supports all enabled toolsets)
    const toolInfo = await this.toolIdentifyService.identifyToolType(toolsetKey);

    this.logger.log(`Exporting schema for toolset: ${toolsetKey}, type: ${toolInfo.type}`);

    // Route to appropriate schema extractor based on type
    switch (toolInfo.type) {
      case 'composio_oauth':
      case 'composio_apikey':
        return await this.exportComposioToolset(toolsetKey);

      case 'config_based':
        return await this.exportConfigBasedToolset(toolsetKey);

      case 'legacy_sdk':
        return await this.exportLegacySdkToolset(toolsetKey);

      case 'mcp':
        throw new ParamsError(`Toolset ${toolsetKey} not supported: MCP tools cannot be exported.`);

      case 'builtin':
        throw new ParamsError(
          `Toolset ${toolsetKey} not supported: builtin tools cannot be exported.`,
        );

      default: {
        const exhaustiveCheck: never = toolInfo.type;
        throw new ParamsError(`Unsupported tool type: ${exhaustiveCheck}`);
      }
    }
  }

  /**
   * Temporary mapping for Composio app keys that use different naming conventions.
   * Composio uses names without underscores (e.g., 'googlesheets'), but our inventory
   * uses names with underscores (e.g., 'google_sheets').
   * TODO: Fix this by updating toolset_inventory keys to match Composio's naming.
   */
  private readonly composioKeyMapping: Record<string, string> = {
    google_sheets: 'googlesheets',
    google_docs: 'googledocs',
    google_drive: 'googledrive',
    google_calendar: 'googlecalendar',
  };

  /**
   * Export Composio toolset definition
   * Fetches tools from Composio API and extracts function.parameters as inputSchema
   *
   * @param toolsetKey - The Composio integration ID
   * @returns Toolset export definition
   */
  private async exportComposioToolset(toolsetKey: string): Promise<ToolsetExportDefinition> {
    // Get toolset metadata from inventory
    const inventoryItem = await this.inventoryService.getInventoryItem(toolsetKey);
    const definition = inventoryItem?.definition;

    // Get toolset name from inventory or use key as fallback
    const name =
      (definition?.labelDict?.en as string) ??
      (definition?.labelDict?.['zh-CN'] as string) ??
      toolsetKey;

    const description =
      (definition?.descriptionDict?.en as string) ??
      (definition?.descriptionDict?.['zh-CN'] as string) ??
      '';

    // Map toolset key to Composio's naming convention if needed
    const composioAppKey = this.composioKeyMapping[toolsetKey] ?? toolsetKey;

    // Fetch tools from Composio API
    // Use 'refly_global' as userId since we're just fetching schemas
    const composioTools = await this.composioService.fetchTools(
      'refly_global',
      composioAppKey,
      2000,
    );

    // Convert Composio tools to export format
    const tools: ToolExportDefinition[] = composioTools
      .filter((tool) => this.isComposioToolValid(tool))
      .map((tool) => this.convertComposioTool(tool));

    return {
      key: toolsetKey,
      name,
      description,
      tools,
    };
  }

  /**
   * Export Config-based toolset definition
   * Loads from database via ToolInventoryService
   *
   * @param toolsetKey - The toolset key
   * @returns Toolset export definition
   */
  private async exportConfigBasedToolset(toolsetKey: string): Promise<ToolsetExportDefinition> {
    // Get full config with methods from database
    const config = await this.inventoryService.getInventoryWithMethods(toolsetKey);

    if (!config) {
      throw new ToolsetNotFoundError(`Toolset not found in inventory: ${toolsetKey}`);
    }

    // Convert methods to export format
    const tools: ToolExportDefinition[] = config.methods.map((method) => {
      // Parse requestSchema from JSON string if needed
      let inputSchema: Record<string, unknown> = {};
      if (method.schema) {
        try {
          inputSchema =
            typeof method.schema === 'string' ? JSON.parse(method.schema) : method.schema;
        } catch (e) {
          this.logger.warn(
            `Failed to parse requestSchema for method ${method.name}: ${(e as Error).message}`,
          );
        }
      }

      // Deep clone and add file_name_title field (consistent with non-PTC mode)
      const enhancedSchema = JSON.parse(JSON.stringify(inputSchema)) as JsonSchema;
      addFileNameTitleField(enhancedSchema);

      return {
        name: method.name,
        description: method.description ?? '',
        inputSchema: enhancedSchema,
      };
    });

    // Get toolset metadata from inventory
    const inventoryItem = await this.inventoryService.getInventoryItem(toolsetKey);
    const definition = inventoryItem?.definition;

    const name = config.name ?? toolsetKey;
    const description =
      (definition?.descriptionDict?.en as string) ??
      (definition?.descriptionDict?.['zh-CN'] as string) ??
      '';

    return {
      key: toolsetKey,
      name,
      description,
      tools,
    };
  }

  /**
   * Export Legacy SDK toolset definition
   * Instantiates the toolset class to extract Zod schemas and converts them to JSON Schema
   *
   * @param toolsetKey - The toolset key
   * @returns Toolset export definition
   */
  private async exportLegacySdkToolset(toolsetKey: string): Promise<ToolsetExportDefinition> {
    // Get toolset class from static inventory
    const inventoryItem = await this.inventoryService.getInventoryItem(toolsetKey);

    if (!inventoryItem?.class) {
      throw new ToolsetNotFoundError(`Legacy SDK toolset class not found: ${toolsetKey}`);
    }

    const ToolsetClass = inventoryItem.class;
    const definition = inventoryItem.definition;

    // Instantiate toolset without params (safe for schema extraction)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const toolset = new ToolsetClass();

    // Initialize tools without params to get tool instances with schemas
    const toolInstances = toolset.initializeTools();

    // Convert each tool's Zod schema to JSON Schema
    const tools: ToolExportDefinition[] = toolInstances.map((tool) => {
      let inputSchema: Record<string, unknown> = {};

      if (tool.schema) {
        try {
          // Convert Zod schema to JSON Schema using openApi3 target for better compatibility
          inputSchema = zodToJsonSchema(tool.schema, { target: 'openApi3' }) as Record<
            string,
            unknown
          >;
        } catch (e) {
          this.logger.warn(
            `Failed to convert Zod schema to JSON Schema for tool ${tool.name}: ${(e as Error).message}`,
          );
        }
      }

      return {
        name: tool.name,
        description: tool.description ?? '',
        inputSchema,
      };
    });

    // Get toolset metadata
    const name =
      (definition?.labelDict?.en as string) ??
      (definition?.labelDict?.['zh-CN'] as string) ??
      toolsetKey;

    const description =
      (definition?.descriptionDict?.en as string) ??
      (definition?.descriptionDict?.['zh-CN'] as string) ??
      '';

    return {
      key: toolsetKey,
      name,
      description,
      tools,
    };
  }

  /**
   * Check if a Composio tool should be included (not deprecated)
   *
   * @param tool - Composio tool definition
   * @returns true if the tool should be included
   */
  private isComposioToolValid(tool: {
    function?: { name?: string; description?: string; parameters?: Record<string, unknown> };
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
    const params = (fn.parameters ?? {}) as Record<string, unknown>;
    const properties = (params?.properties ?? {}) as Record<string, Record<string, unknown>>;
    const hasDeprecatedProps = Object.values(properties).some((prop) => prop?.deprecated === true);

    return !hasDeprecatedProps;
  }

  /**
   * Convert Composio tool to export format
   *
   * @param tool - Composio tool definition
   * @returns Tool export definition
   */
  private convertComposioTool(tool: {
    function?: { name?: string; description?: string; parameters?: Record<string, unknown> };
    description?: string;
  }): ToolExportDefinition {
    const fn = tool.function;

    // Deep clone and add file_name_title field (consistent with non-PTC mode)
    const inputSchema = JSON.parse(JSON.stringify(fn?.parameters ?? {})) as JsonSchema;
    addFileNameTitleField(inputSchema);

    return {
      name: fn?.name ?? 'unknown_tool',
      description: fn?.description ?? '',
      inputSchema,
    };
  }
}
