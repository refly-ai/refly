/**
 * Tool Factory
 * Instantiates executable LangChain tools from tool definitions
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
  DynamicToolDefinition,
  HandlerRequest,
  ParsedMethodConfig,
  ToolsetConfig,
} from '@refly/openapi-schema';
import { CreditService } from '../../../../credit/credit.service';
import { AdapterFactory } from './../../adapters/factory/factory';
import { ToolsetType } from '../../../constant';
import { HttpHandler } from '../../handlers/handler';
import {
  ResourceHandler,
  fillDefaultValues,
  parseJsonSchema,
  resolveCredentials,
} from '../../../utils';
import { getCurrentUser, runInContext, type SkillRunnableConfig } from '../context/tool-context';
import { ConfigLoader } from '../loader/loader.service';
import { ToolDefinitionRegistry } from './definition';

/**
 * Tool factory service
 * Orchestrates tool instantiation by combining definitions with runtime dependencies
 */
@Injectable()
export class ToolFactory implements OnModuleInit {
  private readonly logger = new Logger(ToolFactory.name);
  private readonly toolCache = new Map<string, DynamicStructuredTool[]>();

  constructor(
    private readonly configLoader: ConfigLoader,
    private readonly definitionRegistry: ToolDefinitionRegistry,
    private readonly adapterFactory: AdapterFactory,
    private resourceHandler: ResourceHandler,
    private readonly creditService: CreditService,
  ) {}

  /**
   * Called when the module is initialized
   * Marks configuration loader initialization as complete and preloads configs
   */
  async onModuleInit(): Promise<void> {
    // Wait a short time to ensure all other modules are ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.configLoader.setInitializationComplete();

    // Preload config-based tools on startup for debugging
    try {
      const configs = await this.configLoader.loadAllConfigs(ToolsetType.REGULAR);
      // Register tool definitions for preloaded configs
      for (const config of configs) {
        this.definitionRegistry.registerTools(config);
      }
    } catch (error) {
      this.logger.error(
        `Failed to preload config-based tools: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }

    this.logger.log('ToolFactory initialized');
  }

  /**
   * Get ResourceHandler instance (singleton)
   * Uses injected ResourceHandler from constructor
   */
  private getResourceHandler(): ResourceHandler {
    return this.resourceHandler;
  }

  /**
   * Instantiate tools by inventory key (new simplified API)
   * Uses built-in resource handlers, only requires inventoryKey
   * Credentials are loaded from the config automatically
   * @param inventoryKey - Toolset inventory key (e.g., 'fish_audio', 'heygen')
   * @returns Array of DynamicStructuredTool instances
   */
  async instantiateToolsByKey(inventoryKey: string): Promise<DynamicStructuredTool[]> {
    try {
      // Check cache first
      if (this.toolCache.has(inventoryKey)) {
        return this.toolCache.get(inventoryKey)!;
      }

      // Load configuration from inventory
      const config = await this.configLoader.loadConfig(inventoryKey);
      if (!config) {
        this.logger.warn(`No configuration found for inventory key: ${inventoryKey}`);
        return [];
      }

      // Get tool definitions (already registered in onModuleInit)
      const allDefinitions = this.definitionRegistry.getAllDefinitions();
      const definitions = allDefinitions.filter(
        (def) => def.metadata.toolsetKey === config.inventoryKey,
      );

      if (definitions.length === 0) {
        this.logger.warn(`No tool definitions found for ${inventoryKey}`);
        return [];
      }

      // Credentials are loaded from config.credentials
      const credentials = config.credentials;

      // Create DynamicStructuredTool instances
      const tools = await this.createDynamicTools(config, definitions, credentials);

      // Cache the tools
      this.toolCache.set(inventoryKey, tools);
      this.logger.log(`Instantiated ${tools.length} tools for ${inventoryKey}`);

      return tools;
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

        // Create adapter
        const adapter = await this.adapterFactory.createAdapter(parsedMethod, credentials);

        // Create handler with ResourceHandler for output resource processing
        const handler = new HttpHandler(adapter, {
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
          resourceHandler: this.getResourceHandler(),
        });

        // Create DynamicStructuredTool
        // Use 'as unknown' to avoid excessive depth in type instantiation with complex Zod schemas
        const toolSchema = definition.schema as unknown;
        const tool = new DynamicStructuredTool({
          name: definition.name,
          description: definition.description,
          schema: toolSchema,
          func: async (
            args: Record<string, unknown>,
            _runManager?: any,
            runnableConfig?: SkillRunnableConfig,
          ) => {
            try {
              // Execute via HttpHandler with request context
              const response = await runInContext(
                {
                  langchainConfig: runnableConfig,
                  requestId: `tool-${definition.name}-${Date.now()}`,
                },
                async () => {
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
                  let processedRequest: HandlerRequest = initialRequest;
                  if (parsedMethod.schema?.properties) {
                    const resourceHandler = this.getResourceHandler();
                    processedRequest = await resourceHandler.preprocessInputResources(
                      initialRequest,
                      parsedMethod.schema,
                    );
                  }

                  // Execute handler with preprocessed request
                  return await handler.handle(processedRequest);
                },
              );

              // Return JSON response
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
          },
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
   * Parse method config (similar to ToolDefinitionRegistry.parseMethodConfig)
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
}
