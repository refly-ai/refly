/**
 * Configuration loader implementation
 * Loads tool configurations from database structure (Toolset + ToolMethod)
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ToolsetConfig } from '@refly/openapi-schema';
import { ToolInventoryService } from '../../../inventory/inventory.service';
import type { IConfigLoader } from '../interfaces';

/**
 * Configuration loader service
 * Loads toolset configurations directly from database without caching
 * Version management is controlled by versionId in ToolMethod records
 */
@Injectable()
export class ConfigLoader implements IConfigLoader {
  private readonly logger = new Logger(ConfigLoader.name);

  constructor(private readonly inventoryService: ToolInventoryService) {}

  /**
   * Mark initialization as complete (should be called after service startup)
   */
  setInitializationComplete(): void {
    this.logger.log('Configuration loader initialization complete');
  }

  /**
   * Load configuration by inventory key
   * Fetches raw inventory data via ToolInventoryService and parses into ToolsetConfig
   * @param inventoryKey - Toolset inventory key (e.g., 'fish_audio', 'heygen')
   */
  async loadConfig(inventoryKey: string): Promise<ToolsetConfig | null> {
    try {
      const config = await this.inventoryService.getInventoryWithMethods(inventoryKey);

      if (!config) {
        this.logger.warn(`No inventory found for key: ${inventoryKey}`);
        return null;
      }
      this.logger.log(`Loaded config for ${inventoryKey}, methods: ${config.methods.length}`);
      return config;
    } catch (error) {
      this.logger.error(
        `Failed to load config for ${inventoryKey}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  /**
   * Load all active toolset configurations from inventory
   * @param type - Optional filter by authType (e.g., 'config_based')
   */
  async loadAllConfigs(type: string): Promise<ToolsetConfig[]> {
    try {
      const configs = await this.inventoryService.listInventoriesWithMethods(type);

      this.logger.log(
        `Loaded ${configs.length} toolset configurations from inventory${type ? ` with type=${type}` : ''}`,
      );
      return configs;
    } catch (error) {
      this.logger.error(
        `Failed to load all configs: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return [];
    }
  }

  /**
   * Reload configuration (load fresh from database)
   * @param inventoryKey - Toolset inventory key
   */
  async reloadConfig(inventoryKey: string): Promise<ToolsetConfig | null> {
    this.logger.log(`Reloading config for ${inventoryKey}`);
    return this.loadConfig(inventoryKey);
  }

  /**
   * Clear all cached configurations (no-op since we don't use cache)
   */
  clearCache(): void {
    this.logger.log('Clear cache called (no-op without caching)');
  }
}
