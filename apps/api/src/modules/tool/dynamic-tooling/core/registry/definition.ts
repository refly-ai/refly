/**
 * Tool definition registry implementation
 * Manages tool definition registration (configuration → definition conversion)
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IToolDefinitionRegistry } from '../interfaces';
import type {
  DynamicToolDefinition,
  InstantiatedTool,
  ToolInstantiationContext,
  ToolMetadata,
  ToolsetConfig,
  ParsedMethodConfig,
} from '@refly/openapi-schema';
import { buildSchema, parseJsonSchema } from '../../../utils';

/**
 * Tool definition registry service
 * Converts toolset configurations into tool definitions with metadata and schemas
 */
@Injectable()
export class ToolDefinitionRegistry implements IToolDefinitionRegistry {
  private readonly logger = new Logger(ToolDefinitionRegistry.name);
  private readonly definitions = new Map<string, DynamicToolDefinition>();

  /**
   * Register tools from configuration
   */
  registerTools(config: ToolsetConfig): DynamicToolDefinition[] {
    const definitions: DynamicToolDefinition[] = [];

    for (const method of config.methods) {
      try {
        // Parse method config to extract resource fields
        const parsedMethod = this.parseMethodConfig(method);
        const definition = this.createToolDefinition(config, parsedMethod);
        definitions.push(definition);
        // Store in registry
        this.definitions.set(definition.name, definition);
        this.logger.log(`Registered tool: ${definition.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to register tool ${method.name}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return definitions;
  }

  /**
   * Parse method config to extract resource fields
   */
  private parseMethodConfig(method: ToolsetConfig['methods'][0]): ParsedMethodConfig {
    // Parse JSON schemas - these are already validated as object schemas in the config
    const schema = parseJsonSchema(method.schema);
    const responseSchema = parseJsonSchema(method.responseSchema);

    return {
      ...method,
      schema,
      responseSchema,
    };
  }

  /**
   * Create a tool definition from method config
   */
  private createToolDefinition(
    config: ToolsetConfig,
    method: ParsedMethodConfig,
  ): DynamicToolDefinition {
    // Build Zod schema from JSON schema
    const schema = buildSchema(JSON.stringify(method.schema));
    // Generate tool name (e.g., fish_audio__text_to_speech)
    const toolName = `${method.name}`;
    // Create metadata
    const metadata: ToolMetadata = {
      version: method.version || 1,
      toolsetKey: config.inventoryKey,
      methodName: method.name,
      billing: method.billing,
    };

    return {
      name: toolName,
      description: method.description,
      schema,
      metadata,
    };
  }

  /**
   * Instantiate tools for a specific user context
   * This is a placeholder - actual instantiation happens in the service layer
   */
  async instantiateTools(context: ToolInstantiationContext): Promise<InstantiatedTool[]> {
    this.logger.log(`Instantiating tools for user: ${context.user.uid}`);
    // This method would be implemented by a higher-level service
    // that has access to handlers, adapters, and other dependencies
    return [];
  }

  /**
   * Get tool definition by name
   */
  getToolDefinition(name: string): DynamicToolDefinition | null {
    return this.definitions.get(name) || null;
  }

  /**
   * Get all registered tool definitions
   */
  getAllDefinitions(): DynamicToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.logger.log('Clearing tool registry');
    this.definitions.clear();
  }
}
