/**
 * Tool Factory
 * Instantiates executable LangChain tools from tool definitions
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import type {
  DynamicToolDefinition,
  HandlerRequest,
  JsonSchema,
  ParsedMethodConfig,
  ToolMetadata,
  ToolsetConfig,
} from '@refly/openapi-schema';
import { SkillRunnableConfig } from '@refly/skill-template';
import { SingleFlightCache } from '../../../utils/cache';
import { CreditService } from '../../credit/credit.service';
import { ToolInventoryService } from '../inventory/inventory.service';
import {
  ResourceHandler,
  buildSchema,
  fillDefaultValues,
  parseJsonSchema,
  resolveCredentials,
} from '../utils';
import { AdapterFactory } from './adapters/factory';
import { HttpHandler } from './core/handler';
import { getCurrentUser, runInContext } from './core/tool-context';

/**
 * Tool factory service
 * Orchestrates tool instantiation by combining definitions with runtime dependencies
 */
@Injectable()
export class ToolFactory {
  private readonly logger = new Logger(ToolFactory.name);
  private readonly toolCacheMap = new Map<string, SingleFlightCache<DynamicStructuredTool[]>>();

  constructor(
    private readonly inventoryService: ToolInventoryService,
    private readonly adapterFactory: AdapterFactory,
    private resourceHandler: ResourceHandler,
    private readonly creditService: CreditService,
  ) {}

  /**
   * Clear cache for a specific inventory key
   * Forces tools to be reloaded on next access
   * @param inventoryKey - Toolset inventory key to clear cache for
   */
  clearCache(inventoryKey?: string): void {
    if (inventoryKey) {
      this.toolCacheMap.delete(inventoryKey);
      this.logger.log(`Cleared cache for ${inventoryKey}`);
    } else {
      this.toolCacheMap.clear();
      this.logger.log('Cleared all tool caches');
    }
  }

  /**
   * Instantiate tools by inventory key (new simplified API)
   * Uses built-in resource handlers, only requires inventoryKey
   * Credentials are loaded from the config automatically
   * Cache TTL: 10 minutes
   * @param inventoryKey - Toolset inventory key (e.g., 'fish_audio', 'heygen')
   * @returns Array of DynamicStructuredTool instances
   */
  async instantiateToolsByKey(inventoryKey: string): Promise<DynamicStructuredTool[]> {
    try {
      // Get or create cache for this inventory key
      if (!this.toolCacheMap.has(inventoryKey)) {
        const cache = new SingleFlightCache<DynamicStructuredTool[]>(
          async () => {
            // Load configuration from inventory
            const config = await this.inventoryService.getInventoryWithMethods(inventoryKey);
            if (!config) {
              this.logger.warn(`No configuration found for inventory key: ${inventoryKey}`);
              return [];
            }

            this.logger.log(`Loaded config for ${inventoryKey}, methods: ${config.methods.length}`);

            // Create tool definitions on-demand from the loaded config
            const definitions = this.createToolDefinitions(config);

            if (definitions.length === 0) {
              this.logger.warn(`No tool definitions found for ${inventoryKey}`);
              return [];
            }

            // Create DynamicStructuredTool instances with credentials from config
            const tools = await this.createDynamicTools(config, definitions, config.credentials);

            this.logger.log(`Instantiated ${tools.length} tools for ${inventoryKey}`);
            return tools;
          },
          { ttl: 1000 * 60 * 10 }, // 10 minutes TTL
        );

        this.toolCacheMap.set(inventoryKey, cache);
      }

      // Get from cache (will auto-refresh if expired)
      return await this.toolCacheMap.get(inventoryKey)!.get();
    } catch (error) {
      this.logger.error(
        `Failed to instantiate tools for ${inventoryKey}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return [];
    }
  }

  /**
   * Create DynamicStructuredTool instances from definitions
   */
  private async createDynamicTools(
    config: ToolsetConfig,
    definitions: DynamicToolDefinition[],
    credentialsOverride?: Record<string, unknown>,
  ): Promise<DynamicStructuredTool[]> {
    const tools: DynamicStructuredTool[] = [];

    for (const definition of definitions) {
      try {
        // Find corresponding method config
        const methodConfig = config.methods.find((m) => m.name === definition.metadata.methodName);
        if (!methodConfig) {
          this.logger.warn(`Method config not found for: ${definition.metadata.methodName}`);
          continue;
        }
        // Parse method to get resource fields
        const parsedMethod = this.parseMethodConfig(methodConfig);
        // Resolve credentials
        const credentials = credentialsOverride || resolveCredentials(config.credentials || {});
        // Create handler with adapter and resource processing
        const handler = await this.createHttpHandler(parsedMethod, credentials);
        // Create DynamicStructuredTool
        const toolSchema = definition.schema as unknown;
        const tool = new DynamicStructuredTool({
          name: definition.name,
          description: definition.description,
          schema: toolSchema,
          func: this.createToolExecutor(config, definition, parsedMethod, handler),
        });

        // Attach metadata to tool for tracking
        (tool as any).metadata = {
          ...definition.metadata,
          name: definition.metadata.methodName, // Use methodName as name for event tracking
        };

        tools.push(tool);
      } catch (error) {
        this.logger.error(
          `Failed to create tool ${definition.name}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return tools;
  }

  /**
   * Parse method config to extract resource fields and schemas
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
   * Create HTTP handler with adapter and resource processing configuration
   */
  private async createHttpHandler(
    parsedMethod: ParsedMethodConfig,
    credentials: Record<string, unknown>,
  ): Promise<HttpHandler> {
    const adapter = await this.adapterFactory.createAdapter(parsedMethod, credentials);
    return new HttpHandler(adapter, {
      endpoint: parsedMethod.endpoint,
      method: parsedMethod.method,
      credentials,
      responseSchema: parsedMethod.responseSchema,
      billing: parsedMethod.billing,
      creditService: this.creditService,
      timeout: parsedMethod.timeout,
      useFormData: parsedMethod.useFormData,
      formatResponse: false, // Return JSON, not formatted text
      enableResourceUpload: true, // Enable ResourceHandler for output processing
      resourceHandler: this.resourceHandler,
    });
  }

  /**
   * Create tool executor function
   * Extracts the tool execution logic into a separate method for better maintainability
   */
  private createToolExecutor(
    config: ToolsetConfig,
    definition: DynamicToolDefinition,
    parsedMethod: ParsedMethodConfig,
    handler: HttpHandler,
  ) {
    return async (
      args: Record<string, unknown>,
      _runManager?: any,
      runnableConfig?: SkillRunnableConfig,
    ): Promise<string> => {
      try {
        const response = await runInContext(
          {
            langchainConfig: runnableConfig,
            requestId: `tool-${definition.name}-${Date.now()}`,
          },
          async () => {
            // Prepare request with defaults and resource preprocessing
            const request = await this.prepareToolRequest(config, parsedMethod, args);
            // Execute handler with prepared request
            return await handler.handle(request);
          },
        );

        return JSON.stringify(response, null, 2);
      } catch (error) {
        this.logger.error(
          `Tool execution failed (${definition.name}): ${(error as Error).message}`,
        );
        return JSON.stringify({
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: (error as Error).message,
          },
        });
      }
    };
  }

  /**
   * Prepare tool request with default values and resource preprocessing
   */
  private async prepareToolRequest(
    config: ToolsetConfig,
    parsedMethod: ParsedMethodConfig,
    args: Record<string, unknown>,
  ): Promise<HandlerRequest> {
    // Fill default values from schema
    let paramsWithDefaults = args;
    if (parsedMethod.schema) {
      paramsWithDefaults = fillDefaultValues(args, parsedMethod.schema);
    }

    // Build initial request
    const initialRequest: HandlerRequest = {
      provider: config.domain,
      method: parsedMethod.name,
      params: paramsWithDefaults,
      user: getCurrentUser(),
      metadata: {
        toolName: parsedMethod.name,
        toolsetKey: config.inventoryKey,
      },
    };

    // Preprocess input resources if needed
    if (parsedMethod.schema?.properties) {
      const resourceHandler = this.resourceHandler;
      return await resourceHandler.resolveInputResources(initialRequest, parsedMethod.schema);
    }

    return initialRequest;
  }

  /**
   * Create tool definitions from configuration
   * Converts toolset configuration into tool definitions with metadata and schemas
   */
  private createToolDefinitions(config: ToolsetConfig): DynamicToolDefinition[] {
    const definitions: DynamicToolDefinition[] = [];

    for (const method of config.methods) {
      try {
        // Parse method config to extract resource fields
        const parsedMethod = this.parseMethodConfig(method);
        const definition = this.createToolDefinition(config, parsedMethod);
        definitions.push(definition);
        this.logger.log(`Created tool definition: ${definition.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to create tool definition for ${method.name}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return definitions;
  }

  /**
   * Create a tool definition from method config
   */
  private createToolDefinition(
    config: ToolsetConfig,
    method: ParsedMethodConfig,
  ): DynamicToolDefinition {
    // Add title field to schema for naming generated files
    const schemaWithTitle = this.addTitleFieldToSchema(method.schema);
    // Build Zod schema from JSON schema
    const schema = buildSchema(JSON.stringify(schemaWithTitle));
    // Generate tool name
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
   * Add title field to schema for naming generated files
   * This field will be used by HTTP adapter to name downloaded files
   * @param schema - Original JSON schema
   * @returns Schema with title field added
   */
  private addTitleFieldToSchema(schema: JsonSchema): JsonSchema {
    // Clone schema to avoid mutation
    const newSchema = JSON.parse(JSON.stringify(schema)) as JsonSchema;

    // Add file_name_title field if properties exist and it doesn't already exist
    if (newSchema.properties && !newSchema.properties.file_name_title) {
      newSchema.properties.file_name_title = {
        type: 'string',
        description:
          'The title for the generated file. Should be concise and descriptive. This will be used as the filename.',
      };
      // Add file_name_title to required fields so AI will always generate it
      if (!newSchema.required) {
        newSchema.required = [];
      }
      if (!newSchema.required.includes('file_name_title')) {
        newSchema.required.push('file_name_title');
      }
    }

    return newSchema;
  }
}
