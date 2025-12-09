/**
 * Tool Inventory Service
 * Manages the global tool inventory loaded from database
 * Replaces the hardcoded toolsetInventory from @refly/agent-tools
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  GenericToolsetType,
  ToolsetDefinition,
  ToolsetConfig,
  PollingConfig,
  BillingConfig,
} from '@refly/openapi-schema';
import { safeParseJSON, runModuleInitWithTimeoutAndRetry } from '@refly/utils';
import { toolsetInventory as staticToolsetInventory } from '@refly/agent-tools';
import { SingleFlightCache } from '../../../utils/cache';
import { BillingType } from '../constant';
import type { ToolMethod, ToolsetInventory } from '@prisma/client';

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
  private inventoryCache: SingleFlightCache<Map<string, ToolsetInventoryItem>>;

  // Timeout for initialization operations (30 seconds)
  private readonly INIT_TIMEOUT = 30000;

  constructor(private readonly prisma: PrismaService) {
    // Cache inventory with 5-minute TTL
    this.inventoryCache = new SingleFlightCache(this.loadFromDatabase.bind(this), {
      ttl: 5 * 60 * 1000,
    });
  }

  /**
   * Initialize on module startup
   */
  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      async () => {
        this.logger.log('Initializing Tool Inventory Service...');
        try {
          const inventory = await this.loadFromDatabase();
          this.logger.log(`Tool Inventory initialized with ${inventory.size} toolsets`);
        } catch (error) {
          this.logger.error(`Failed to initialize Tool Inventory: ${error}`);
          throw error;
        }
      },
      {
        logger: this.logger,
        label: 'ToolInventoryService.onModuleInit',
        timeoutMs: this.INIT_TIMEOUT,
      },
    );
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
        type: item.type as GenericToolsetType,
        domain: item.domain || undefined,
        labelDict: safeParseJSON(item.labelDict) || {},
        descriptionDict: safeParseJSON(item.descriptionDict) || {},
        tools: methods.map((method) => ({
          name: method.name,
          descriptionDict: { en: method.description, 'zh-CN': method.description },
        })),
        authPatterns,
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
   * Build ToolsetConfig from raw inventory + methods using schema types
   */
  private buildConfigFromRecords(
    inventory: ToolsetInventory,
    methods: ToolMethod[],
  ): ToolsetConfig | null {
    // Keep only the latest version per method name
    const methodMap = new Map<string, ToolMethod>();
    for (const method of methods) {
      if (!methodMap.has(method.name)) {
        methodMap.set(method.name, method);
      }
    }
    const dedupedMethods = Array.from(methodMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    if (dedupedMethods.length === 0) {
      this.logger.warn(`No methods found for inventory key: ${inventory.key}`);
      return null;
    }

    // Parse credit billing config with backward compatibility
    // Supports both simple number values and full BillingConfig objects
    const creditBillingMap: Record<string, number | BillingConfig> = {};
    let globalCreditDefault: number | undefined;

    const parsePrice = (value: unknown): number | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const num = Number(value);
        if (Number.isFinite(num)) return num;
      }
      if (value && typeof value === 'object') {
        const candidate =
          (value as Record<string, unknown>).price ??
          (value as Record<string, unknown>).credits ??
          (value as Record<string, unknown>).creditsPerCall;
        return parsePrice(candidate);
      }
      return undefined;
    };

    /**
     * Check if a value is a full BillingConfig object
     * A valid BillingConfig must have 'enabled' and 'type' properties
     */
    const isBillingConfig = (value: unknown): value is BillingConfig => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const obj = value as Record<string, unknown>;
      return (
        typeof obj.enabled === 'boolean' &&
        typeof obj.type === 'string' &&
        (obj.type === BillingType.PER_CALL || obj.type === BillingType.PER_QUANTITY)
      );
    };

    if (inventory.creditBilling) {
      try {
        const parsed = JSON.parse(inventory.creditBilling);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [methodName, priceValue] of Object.entries(parsed)) {
            // First check if it's a full BillingConfig object
            if (isBillingConfig(priceValue)) {
              creditBillingMap[methodName] = priceValue;
            } else {
              // Fall back to parsing as a simple number
              const parsedPrice = parsePrice(priceValue);
              if (parsedPrice !== undefined) {
                creditBillingMap[methodName] = parsedPrice;
              }
            }
          }
        } else {
          const parsedPrice = parsePrice(parsed);
          if (parsedPrice !== undefined) {
            globalCreditDefault = parsedPrice;
          }
        }
      } catch {
        const parsedPrice = parsePrice(inventory.creditBilling);
        if (parsedPrice !== undefined) {
          globalCreditDefault = parsedPrice;
        }
      }
    }
    const defaultCreditsPerCall = globalCreditDefault ?? 1;

    let apiKeyHeaderFromAdapter: string | undefined;

    const parsedMethods = dedupedMethods.map((method) => {
      // Parse adapter config if present
      let adapterConfig: Record<string, unknown> = {};
      try {
        if (method.adapterConfig) {
          adapterConfig = JSON.parse(method.adapterConfig);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to parse adapterConfig for method ${method.name}: ${(error as Error).message}`,
        );
      }

      // Detect api-key header in adapterConfig to later drive auth header style
      if (!apiKeyHeaderFromAdapter && adapterConfig.headers) {
        const headerKey = Object.keys(adapterConfig.headers as Record<string, unknown>).find(
          (key) => key.toLowerCase().includes('api-key'),
        );
        if (headerKey) {
          apiKeyHeaderFromAdapter = headerKey;
        }
      }

      // Normalize polling config (ensure absolute statusUrl)
      let pollingConfig: PollingConfig | undefined;
      const pollingFromAdapter = adapterConfig.polling as PollingConfig | undefined;
      if (pollingFromAdapter?.statusUrl) {
        let statusUrl = pollingFromAdapter.statusUrl;
        const isAbsolute = /^https?:\/\//i.test(statusUrl);
        if (!isAbsolute && inventory.domain) {
          try {
            statusUrl = new URL(statusUrl, inventory.domain).toString();
          } catch (error) {
            this.logger.warn(
              `Failed to normalize polling.statusUrl for method ${method.name}: ${(error as Error).message}`,
            );
          }
        }
        pollingConfig = {
          ...pollingFromAdapter,
          statusUrl,
        };
      }

      return {
        name: method.name,
        version: Number(method.versionId),
        description: method.description,
        endpoint: method.endpoint,
        method: method.httpMethod as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        schema: method.requestSchema,
        responseSchema: method.responseSchema,
        useSdk: method.adapterType === 'sdk',
        timeout: (adapterConfig.timeout as number | undefined) || 30000,
        maxRetries: adapterConfig.maxRetries as number | undefined,
        useFormData: adapterConfig.useFormData as boolean | undefined,
        polling: pollingConfig,
        defaultHeaders: adapterConfig.headers as Record<string, string> | undefined,
        billing: this.buildBillingConfig(creditBillingMap[method.name], defaultCreditsPerCall),
      };
    });

    const credentials = inventory.apiKey
      ? {
          apiKey: inventory.apiKey,
          ...(apiKeyHeaderFromAdapter ? { apiKeyHeader: apiKeyHeaderFromAdapter } : {}),
        }
      : undefined;

    return {
      inventoryKey: inventory.key,
      domain: inventory.domain || '',
      name: inventory.name,
      credentials,
      methods: parsedMethods,
    };
  }

  /**
   * Build billing config from method-specific config or default
   * Supports both simple number (credits per call) and full BillingConfig objects
   *
   * @param methodBilling - Method-specific billing config (number or BillingConfig)
   * @param defaultCreditsPerCall - Default credits per call if not specified
   * @returns Complete BillingConfig object
   */
  private buildBillingConfig(
    methodBilling: number | BillingConfig | undefined,
    defaultCreditsPerCall: number,
  ): BillingConfig {
    // If it's a full BillingConfig object, use it directly
    if (
      methodBilling &&
      typeof methodBilling === 'object' &&
      'enabled' in methodBilling &&
      'type' in methodBilling
    ) {
      return methodBilling;
    }

    // Otherwise, create a PER_CALL config with the specified or default credits
    const credits = typeof methodBilling === 'number' ? methodBilling : defaultCreditsPerCall;

    return {
      enabled: true,
      type: BillingType.PER_CALL,
      creditsPerCall: credits,
    };
  }

  /**
   * Load full inventory data (including methods) for a specific key
   * Used by runtime config loader to build ToolsetConfig
   */
  async getInventoryWithMethods(key: string): Promise<ToolsetConfig | null> {
    const inventory = await this.prisma.toolsetInventory.findFirst({
      where: {
        key,
        enabled: true,
        deletedAt: null,
      },
    });

    if (!inventory) {
      return null;
    }

    const methods = await this.prisma.toolMethod.findMany({
      where: {
        inventoryKey: inventory.key,
        enabled: true,
        deletedAt: null,
      },
      orderBy: {
        versionId: 'desc',
      },
    });

    return this.buildConfigFromRecords(inventory, methods);
  }

  /**
   * Load all enabled inventories with their methods
   * Optionally filter by inventory type
   */
  async listInventoriesWithMethods(type?: string): Promise<ToolsetConfig[]> {
    const inventories = await this.prisma.toolsetInventory.findMany({
      where: {
        enabled: true,
        deletedAt: null,
        ...(type ? { type } : {}),
      },
      orderBy: {
        key: 'asc',
      },
    });

    if (inventories.length === 0) {
      return [];
    }

    const methods = await this.prisma.toolMethod.findMany({
      where: {
        inventoryKey: { in: inventories.map((item) => item.key) },
        enabled: true,
        deletedAt: null,
      },
      orderBy: {
        versionId: 'desc',
      },
    });

    const methodsByKey = methods.reduce<Map<string, ToolMethod[]>>((map, method) => {
      const list = map.get(method.inventoryKey) || [];
      list.push(method);
      map.set(method.inventoryKey, list);
      return map;
    }, new Map());

    return inventories
      .map((item) => this.buildConfigFromRecords(item, methodsByKey.get(item.key) || []))
      .filter((config): config is ToolsetConfig => Boolean(config));
  }

  /**
   * Get the entire inventory map
   * Loads directly from database on each call
   * @returns Inventory map (key -> ToolsetInventoryItem)
   */
  async getInventoryMap(): Promise<Record<string, ToolsetInventoryItem>> {
    const inventory = await this.inventoryCache.get();
    return Object.fromEntries(inventory);
  }

  /**
   * Get inventory item by key
   * Loads directly from database on each call
   * @param key - Toolset key
   * @returns ToolsetInventoryItem or undefined
   */
  async getInventoryItem(key: string): Promise<ToolsetInventoryItem | undefined> {
    const inventory = await this.inventoryCache.get();
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
    const inventory = await this.inventoryCache.get();
    return Array.from(inventory.keys());
  }

  /**
   * Get all inventory definitions
   * Loads directly from database on each call
   * @returns Array of ToolsetDefinition
   */
  async getInventoryDefinitions(): Promise<ToolsetDefinition[]> {
    const inventory = await this.inventoryCache.get();
    return Array.from(inventory.values()).map((item) => item.definition);
  }

  /**
   * Check if a toolset exists in inventory
   * Loads directly from database on each call
   * @param key - Toolset key
   * @returns boolean
   */
  async hasInventoryItem(key: string): Promise<boolean> {
    const inventory = await this.inventoryCache.get();
    return inventory.has(key);
  }

  /**
   * Get inventory size
   * Loads directly from database on each call
   * @returns Number of toolsets in inventory
   */
  async getInventorySize(): Promise<number> {
    const inventory = await this.inventoryCache.get();
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
      // Manually update cache and timestamp
      this.inventoryCache.set(inventory);
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
