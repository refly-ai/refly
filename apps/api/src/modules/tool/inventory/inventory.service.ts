/**
 * Tool Inventory Service
 * Manages the global tool inventory loaded from database
 * Replaces the hardcoded toolsetInventory from @refly/agent-tools
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { safeParseJSON } from '@refly/utils';
import { toolsetInventory as staticToolsetInventory } from '@refly/agent-tools';

export interface ToolsetInventoryItem {
  class: any; // Reserved for SDK-based toolsets
  definition: ToolsetDefinition;
}

/**
 * Tool Inventory Service
 * Loads toolset inventory directly from database
 */
@Injectable()
export class ToolInventoryService implements OnModuleInit {
  private readonly logger = new Logger(ToolInventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialize on module startup
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Tool Inventory Service...');
    const inventory = await this.loadFromDatabase();
    this.logger.log(`Tool Inventory initialized with ${inventory.size} toolsets`);
  }

  /**
   * Load inventory directly from database and merge with static inventory
   * @returns Inventory map
   */
  async loadFromDatabase(): Promise<Map<string, ToolsetInventoryItem>> {
    const inventory = new Map<string, ToolsetInventoryItem>();

    // First, load static toolset inventory from @refly/agent-tools
    for (const [key, item] of Object.entries(staticToolsetInventory)) {
      inventory.set(key, {
        class: item.class,
        definition: item.definition,
      });
    }

    // Then, load from database and override static ones if they exist
    const inventoryItems = await this.prisma.toolsetInventory.findMany({
      where: {
        enabled: true,
        deletedAt: null,
      },
      orderBy: {
        key: 'asc',
      },
    });

    // Load all tool methods for enabled inventories
    const toolMethods = await this.prisma.toolMethod.findMany({
      where: {
        inventoryKey: { in: inventoryItems.map((item) => item.key) },
        enabled: true,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Group methods by inventory key
    const methodsByKey = new Map<string, typeof toolMethods>();
    for (const method of toolMethods) {
      const existing = methodsByKey.get(method.inventoryKey) || [];
      existing.push(method);
      methodsByKey.set(method.inventoryKey, existing);
    }

    for (const item of inventoryItems) {
      // Get methods for this inventory
      const methods = methodsByKey.get(item.key) || [];

      // Generate authPatterns based on type
      let authPatterns = undefined;
      let requiresAuth = false;

      if (item.type === 'external_oauth') {
        // For external_oauth type, generate oauth auth pattern
        authPatterns = [
          {
            type: 'oauth' as const,
            provider: item.key, // Use toolset key as provider
            scope: '', // Scope will be configured per installation
          },
        ];
        requiresAuth = true;
      }

      const definition: ToolsetDefinition = {
        key: item.key,
        domain: item.domain || undefined,
        labelDict: safeParseJSON(item.labelDict) || {},
        descriptionDict: safeParseJSON(item.descriptionDict) || {},
        tools: methods.map((method) => ({
          name: method.name,
          descriptionDict: { en: method.description, 'zh-CN': method.description },
        })),
        authPatterns,
        configItems: item.configItems ? safeParseJSON(item.configItems) : undefined,
        requiresAuth,
      };

      // Database entries can have a class (for SDK-based tools)
      // If the static inventory already has this key, preserve its class
      const existingClass = inventory.get(item.key)?.class;

      inventory.set(item.key, {
        class: existingClass || undefined,
        definition,
      });
    }

    this.logger.debug(
      `Loaded ${inventoryItems.length} toolsets from database, ${Object.keys(staticToolsetInventory).length} from static inventory, total: ${inventory.size}`,
    );

    return inventory;
  }

  /**
   * Get the entire inventory map
   * Loads directly from database on each call
   * @returns Inventory map (key -> ToolsetInventoryItem)
   */
  async getInventoryMap(): Promise<Record<string, ToolsetInventoryItem>> {
    const inventory = await this.loadFromDatabase();
    return Object.fromEntries(inventory);
  }

  /**
   * Get inventory item by key
   * Loads directly from database on each call
   * @param key - Toolset key
   * @returns ToolsetInventoryItem or undefined
   */
  async getInventoryItem(key: string): Promise<ToolsetInventoryItem | undefined> {
    const inventory = await this.loadFromDatabase();
    return inventory.get(key);
  }

  /**
   * Get toolset definition by inventory key/name
   * Loads directly from database on each call
   * @param key - Toolset inventory key (name)
   * @returns ToolsetDefinition or undefined if not found
   */
  async getDefinitionByKey(key: string): Promise<ToolsetDefinition | undefined> {
    const inventoryItem = await this.getInventoryItem(key);
    return inventoryItem?.definition;
  }

  /**
   * Get toolset name by inventory key
   * Loads from database directly to get the name field
   * @param key - Toolset inventory key
   * @returns Toolset name or undefined if not found
   */
  async getNameByKey(key: string): Promise<string | undefined> {
    const toolset = await this.prisma.toolsetInventory.findUnique({
      where: {
        key,
        enabled: true,
        deletedAt: null,
      },
      select: {
        name: true,
      },
    });
    return toolset?.name;
  }

  /**
   * Get all inventory keys
   * Loads directly from database on each call
   * @returns Array of toolset keys
   */
  async getInventoryKeys(): Promise<string[]> {
    const inventory = await this.loadFromDatabase();
    return Array.from(inventory.keys());
  }

  /**
   * Get all inventory definitions
   * Loads directly from database on each call
   * @returns Array of ToolsetDefinition
   */
  async getInventoryDefinitions(): Promise<ToolsetDefinition[]> {
    const inventory = await this.loadFromDatabase();
    return Array.from(inventory.values()).map((item) => item.definition);
  }

  /**
   * Check if a toolset exists in inventory
   * Loads directly from database on each call
   * @param key - Toolset key
   * @returns boolean
   */
  async hasInventoryItem(key: string): Promise<boolean> {
    const inventory = await this.loadFromDatabase();
    return inventory.has(key);
  }

  /**
   * Get inventory size
   * Loads directly from database on each call
   * @returns Number of toolsets in inventory
   */
  async getInventorySize(): Promise<number> {
    const inventory = await this.loadFromDatabase();
    return inventory.size;
  }

  /**
   * Reload from database
   * Use this when inventory data changes
   */
  async refresh(): Promise<void> {
    this.logger.log('Manual inventory refresh triggered');
    try {
      const inventory = await this.loadFromDatabase();
      this.logger.log(`Inventory refreshed with ${inventory.size} toolsets`);
    } catch (error) {
      this.logger.error(
        `Failed to refresh inventory: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
