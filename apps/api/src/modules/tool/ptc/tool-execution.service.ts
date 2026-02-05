/**
 * Tool Execution Service
 * Unified service for executing tools via API. Basic components for PTC.
 *
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  User,
  ExecuteToolRequest,
  HandlerRequest,
  HandlerResponse,
  ParsedMethodConfig,
  ToolsetConfig,
} from '@refly/openapi-schema';
import type { SkillRunnableConfig } from '@refly/skill-template';
import { ParamsError } from '@refly/errors';
import { toolsetInventory } from '@refly/agent-tools';
import type { AgentBaseTool, ToolCallResult } from '@refly/agent-tools';
import { safeParseJSON } from '@refly/utils';
import { ComposioService } from '../composio/composio.service';
import { ToolIdentifyService } from './tool-identify.service';
import type { ToolIdentification } from './tool-identify.service';
import { ToolCallService, ToolCallStatus } from '../../tool-call/tool-call.service';
import { PrismaService } from '../../common/prisma.service';
import { EncryptionService } from '../../common/encryption.service';
import { ToolInventoryService } from '../inventory/inventory.service';
import { AdapterFactory } from '../dynamic-tooling/adapters/factory';
import { HttpHandler } from '../dynamic-tooling/core/handler';
import { BillingService } from '../billing/billing.service';
import { ResourceHandler, parseJsonSchema, resolveCredentials, fillDefaultValues } from '../utils';
import { runInContext } from '../tool-context';

/**
 * PTC (Programmatic Tool Call) context for /v1/tool/execute API
 * Passed from sandbox environment via HTTP headers
 */
export interface PtcToolExecuteContext {
  /** Parent call ID from execute_code tool */
  ptcCallId?: string;
  /** Result ID for the action */
  resultId?: string;
  /** Result version */
  version?: number;
  /** Canvas ID for resource upload */
  canvasId?: string;
}

export enum CallType {
  PTC = 'ptc',
  STANDALONE = 'standalone',
}

@Injectable()
export class ToolExecutionService {
  private readonly logger = new Logger(ToolExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly composioService: ComposioService,
    private readonly toolIdentifyService: ToolIdentifyService,
    private readonly toolCallService: ToolCallService,
    private readonly inventoryService: ToolInventoryService,
    private readonly adapterFactory: AdapterFactory,
    private readonly resourceHandler: ResourceHandler,
    private readonly billingService: BillingService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Execute a tool by toolset key and tool name
   * Routes to the appropriate executor based on tool type
   *
   * @param user - The user executing the tool
   * @param request - The execution request (toolsetKey, toolName, arguments)
   * @param ptcContext - Optional PTC context for sandbox tool calls
   * @returns Tool execution result
   */
  async executeTool(
    user: User,
    request: ExecuteToolRequest,
    ptcContext?: PtcToolExecuteContext,
  ): Promise<Record<string, unknown>> {
    const { toolsetKey, toolName, arguments: args } = request;

    if (!toolsetKey) {
      throw new ParamsError('toolsetKey is required');
    }

    if (!toolName) {
      throw new ParamsError('toolName is required');
    }

    // Determine call type and context
    const hasPtcContext = !!ptcContext?.ptcCallId;
    const callType = hasPtcContext ? CallType.PTC : CallType.STANDALONE;

    // Get resultId/version from HTTP headers (ptcContext)
    const resultId = ptcContext?.resultId;
    const version = ptcContext?.version;

    // For PTC mode, fetch stepName from parent execute_code call
    let stepName: string | undefined;
    if (hasPtcContext && ptcContext?.ptcCallId) {
      try {
        const parentCall = await this.prisma.toolCallResult.findUnique({
          where: { callId: ptcContext.ptcCallId },
          select: { stepName: true },
        });
        stepName = parentCall?.stepName ?? undefined;
      } catch (error) {
        this.logger.warn(
          `Failed to fetch stepName for ptcCallId ${ptcContext.ptcCallId}: ${error}`,
        );
      }
    }

    // Generate a unique call ID for this execution
    const callId = this.generateCallId(callType);
    const startTime = Date.now();

    this.logger.log(
      `Executing tool: ${toolName} from toolset: ${toolsetKey}, type: ${callType}, callId: ${callId}`,
    );

    // 1. Persist initial "executing" record BEFORE any execution logic
    await this.persistToolCallStart({
      callId,
      uid: user.uid,
      toolsetId: toolsetKey,
      toolName,
      input: { input: args ?? {} },
      type: callType,
      ptcCallId: ptcContext?.ptcCallId,
      resultId: resultId ?? 'non-result-id',
      version: version ?? 0,
      createdAt: startTime,
      stepName, // Pass stepName for PTC calls
    });

    // 2. Execute tool and capture result
    let result: Record<string, unknown>;
    let errorMessage: string | undefined;

    try {
      // Identify tool type and get connection info
      const toolInfo = await this.toolIdentifyService.identifyTool(user, toolsetKey);

      // Route to appropriate executor based on type
      switch (toolInfo.type) {
        case 'composio_oauth':
        case 'composio_apikey':
          result = await this.executeComposioTool(toolInfo, toolName, args ?? {});
          break;

        case 'config_based':
          result = await this.executeConfigBasedTool(
            user,
            toolsetKey,
            toolName,
            args ?? {},
            ptcContext,
          );
          break;

        case 'legacy_sdk':
          result = await this.executeLegacySdkTool(
            user,
            toolsetKey,
            toolName,
            args ?? {},
            ptcContext,
          );
          break;

        case 'mcp':
          throw new ParamsError(
            `Toolset ${toolsetKey} not supported: MCP tool execution is not supported.`,
          );

        case 'builtin':
          throw new ParamsError(
            `Toolset ${toolsetKey} not supported: builtin tool execution is not supported.`,
          );

        default:
          throw new ParamsError(`Unsupported tool type: ${toolInfo.type}`);
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      result = { status: 'error', error: errorMessage };
    }

    // 4. Update record with final status
    const endTime = Date.now();
    if (result?.status === 'error') {
      const resultError = result?.error;
      const derivedErrorMessage =
        typeof resultError === 'string'
          ? resultError
          : resultError != null
            ? String(resultError)
            : String(result);
      errorMessage = errorMessage ?? derivedErrorMessage;
    }
    const status = errorMessage ? ToolCallStatus.FAILED : ToolCallStatus.COMPLETED;

    await this.persistToolCallEnd({
      callId,
      output: result,
      status,
      error: errorMessage,
      updatedAt: endTime,
    });

    return result;
  }

  /**
   * Generate a unique call ID for tool execution
   * Format: `{callType}:{uuid}` (toolset/tool info lives in the DB record)
   */
  private generateCallId(callType: CallType): string {
    return `${callType}:${randomUUID()}`;
  }

  /**
   * Persist initial tool call record with "executing" status
   */
  private async persistToolCallStart(params: {
    callId: string;
    uid: string;
    toolsetId: string;
    toolName: string;
    input: Record<string, unknown>;
    type: 'ptc' | 'standalone';
    ptcCallId?: string;
    resultId: string;
    version: number;
    createdAt: number;
    stepName?: string;
  }): Promise<void> {
    const {
      callId,
      uid,
      toolsetId,
      toolName,
      input,
      type,
      ptcCallId,
      resultId,
      version,
      createdAt,
      stepName,
    } = params;

    await this.prisma.toolCallResult.create({
      data: {
        callId,
        uid,
        toolsetId,
        toolName,
        input: JSON.stringify(input),
        output: '',
        status: ToolCallStatus.EXECUTING,
        type,
        ptcCallId: ptcCallId ?? null,
        resultId,
        version,
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
        stepName: stepName ?? null,
      },
    });
  }

  /**
   * Update tool call record with final status
   */
  private async persistToolCallEnd(params: {
    callId: string;
    output: Record<string, unknown>;
    status: ToolCallStatus;
    error?: string;
    updatedAt: number;
  }): Promise<void> {
    const { callId, output, status, error, updatedAt } = params;

    await this.prisma.toolCallResult.update({
      where: { callId },
      data: {
        output: JSON.stringify(output),
        status,
        error: error ?? null,
        updatedAt: new Date(updatedAt),
      },
    });
  }

  /**
   * Execute a Composio tool (OAuth or API Key)
   *
   * @param toolInfo - Tool identification info
   * @param toolName - Tool method name
   * @param args - Tool arguments
   * @returns Execution result
   */
  private async executeComposioTool(
    toolInfo: ToolIdentification,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!toolInfo.connectedAccountId || !toolInfo.userId) {
      throw new ParamsError('Missing connection info for Composio tool execution');
    }

    const result = await this.composioService.executeTool(
      toolInfo.userId,
      toolInfo.connectedAccountId,
      toolName,
      args,
    );

    // Return the result data
    // Composio tools return { successful: boolean, data: any, error?: string }
    if (result.successful) {
      return {
        status: 'success',
        data: result.data,
      };
    }

    return {
      status: 'error',
      error: result.error ?? 'Tool execution failed',
      data: result.data,
    };
  }

  /**
   * Execute a config-based tool (database-driven dynamic tools)
   *
   * @param user - The user executing the tool
   * @param toolsetKey - The toolset key (e.g., 'firecrawl', 'fal_image')
   * @param toolName - Tool method name
   * @param args - Tool arguments
   * @returns Execution result
   */
  private async executeConfigBasedTool(
    user: User,
    toolsetKey: string,
    toolName: string,
    args: Record<string, unknown>,
    ptcContext?: PtcToolExecuteContext,
  ): Promise<Record<string, unknown>> {
    // Step 1: Load tool configuration from inventory
    const config = await this.inventoryService.getInventoryWithMethods(toolsetKey);
    if (!config) {
      throw new ParamsError(`Toolset configuration not found: ${toolsetKey}`);
    }

    // Step 2: Find the target method
    const methodConfig = config.methods.find((m) => m.name === toolName);
    if (!methodConfig) {
      throw new ParamsError(
        `Method '${toolName}' not found in toolset '${toolsetKey}'. Available methods: ${config.methods.map((m) => m.name).join(', ')}`,
      );
    }

    // Step 3: Parse method config and resolve credentials
    const parsedMethod = this.parseMethodConfig(methodConfig);
    const credentials = resolveCredentials(config.credentials || {});

    // Step 4: Create HTTP handler
    const handler = await this.createHttpHandler(config, parsedMethod, credentials);

    // Step 5: Prepare request with defaults and resource preprocessing
    const request = await this.prepareToolRequest(config, parsedMethod, args, user);

    // Step 6: Execute handler within request context
    const runnableConfig: SkillRunnableConfig = {
      configurable: {
        user,
        context: {},
        resultId: ptcContext?.resultId,
        version: ptcContext?.version,
        canvasId: ptcContext?.canvasId,
      },
    };

    const toolNameValue = parsedMethod?.name ?? '';
    const toolsetKeyValue = config?.inventoryKey ?? '';
    const response = await runInContext(
      {
        langchainConfig: runnableConfig,
        requestId: `ptc-${toolsetKeyValue}-${toolNameValue}-${Date.now()}`,
        metadata: { toolName: toolNameValue, toolsetKey: toolsetKeyValue },
      },
      async () => handler.handle(request),
    );

    // Step 7: Convert HandlerResponse to execution result format
    return this.convertHandlerResponse(response);
  }

  /**
   * Parse method config to extract schemas
   */
  private parseMethodConfig(method: ToolsetConfig['methods'][0]): ParsedMethodConfig {
    const schema = parseJsonSchema(method.schema);
    const responseSchema = parseJsonSchema(method.responseSchema);

    return {
      ...method,
      schema,
      responseSchema,
    };
  }

  /**
   * Create HTTP handler for config-based tool execution
   */
  private async createHttpHandler(
    _config: ToolsetConfig,
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
      billingService: this.billingService,
      timeout: parsedMethod.timeout,
      useFormData: parsedMethod.useFormData,
      formatResponse: false, // Return JSON, not formatted text
      enableResourceUpload: true, // Enable ResourceHandler for output processing
      resourceHandler: this.resourceHandler,
    });
  }

  /**
   * Prepare tool request with default values and resource preprocessing
   */
  private async prepareToolRequest(
    config: ToolsetConfig,
    parsedMethod: ParsedMethodConfig,
    args: Record<string, unknown>,
    user: User,
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
      user,
      metadata: {
        toolName: parsedMethod.name,
        toolsetKey: config.inventoryKey,
      },
    };

    // Preprocess input resources if needed
    if (parsedMethod.schema?.properties) {
      return await this.resourceHandler.resolveInputResources(initialRequest, parsedMethod.schema);
    }

    return initialRequest;
  }

  /**
   * Convert HandlerResponse to unified execution result format
   */
  private convertHandlerResponse(response: HandlerResponse): Record<string, unknown> {
    if (response.success) {
      return {
        status: 'success',
        data: response.data,
        ...(response.files ? { files: response.files } : {}),
        ...(response.metadata ? { metadata: response.metadata } : {}),
      };
    }

    return {
      status: 'error',
      error: response.error ?? 'Tool execution failed',
      errorCode: response.errorCode,
    };
  }

  /**
   * Safely invoke a legacy SDK tool using the LangChain invoke interface.
   */
  private async invokeToolSafely(
    toolInstance: AgentBaseTool<unknown>,
    args: Record<string, unknown>,
    runnableConfig: SkillRunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const result = await toolInstance.invoke(args, runnableConfig);

      if (typeof result === 'object' && result !== null) {
        return result as ToolCallResult;
      }

      return {
        status: 'success',
        data: result,
        summary: String(result),
      };
    } catch (error) {
      this.logger.error(
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        summary: 'Tool execution failed',
      };
    }
  }

  /**
   * Execute a Legacy SDK tool (e.g., Perplexity, Notion, Jina).
   */
  private async executeLegacySdkTool(
    user: User,
    toolsetKey: string,
    toolName: string,
    args: Record<string, unknown>,
    ptcContext?: PtcToolExecuteContext,
  ): Promise<Record<string, unknown>> {
    const userId = user?.uid;
    if (!userId) {
      throw new ParamsError('User is required for tool execution');
    }

    const inventoryItem = toolsetInventory?.[toolsetKey];
    if (!inventoryItem?.class) {
      throw new ParamsError(`Legacy SDK toolset not found or not implemented: ${toolsetKey}`);
    }

    const toolsetPO = await this.prisma.toolset.findFirst({
      where: {
        key: toolsetKey,
        enabled: true,
        deletedAt: null,
        uninstalled: false,
        OR: [{ uid: userId }, { isGlobal: true }],
      },
      orderBy: { isGlobal: 'asc' },
    });

    if (!toolsetPO) {
      throw new ParamsError(`Toolset '${toolsetKey}' not found or not enabled for user`);
    }

    const config = toolsetPO?.config ? safeParseJSON(toolsetPO?.config) : {};
    const authData = toolsetPO?.authData
      ? safeParseJSON(this.encryptionService.decrypt(toolsetPO?.authData))
      : {};

    const toolParams = {
      ...config,
      ...authData,
      user,
      isGlobalToolset: toolsetPO?.isGlobal ?? false,
    };

    const toolsetInstance = new inventoryItem.class(toolParams);

    let toolInstance: AgentBaseTool<unknown>;
    try {
      toolInstance = toolsetInstance.getToolInstance(toolName);
    } catch (_error) {
      const tools = inventoryItem?.definition?.tools;
      const availableTools = Array.isArray(tools)
        ? tools
            .map((tool) => tool?.name ?? '')
            .filter(Boolean)
            .join(', ')
        : 'none';
      throw new ParamsError(
        `Tool '${toolName}' not found in toolset '${toolsetKey}'. Available tools: ${availableTools}`,
      );
    }

    const runnableConfig: SkillRunnableConfig = {
      configurable: {
        user,
        context: {},
        resultId: ptcContext?.resultId,
        version: ptcContext?.version,
        canvasId: ptcContext?.canvasId,
      },
    };

    const toolCallResult = await this.invokeToolSafely(toolInstance, args, runnableConfig);

    const creditCost = toolCallResult?.creditCost ?? 0;
    if (creditCost > 0 && toolsetPO?.isGlobal && toolCallResult?.status !== 'error') {
      try {
        await this.billingService.processBilling({
          uid: userId,
          toolName,
          toolsetKey,
          discountedPrice: creditCost,
          originalPrice: creditCost,
          resultId: ptcContext?.resultId,
          version: ptcContext?.version,
        });
      } catch (billingError) {
        this.logger.error(
          `Billing failed for ${toolsetKey}.${toolName}: ${billingError instanceof Error ? billingError.message : String(billingError)}`,
        );
      }
    }

    if (toolCallResult?.status === 'success') {
      return {
        status: 'success',
        data: toolCallResult?.data,
        ...(toolCallResult?.summary ? { summary: toolCallResult?.summary } : {}),
        ...(toolCallResult?.files ? { files: toolCallResult?.files } : {}),
      };
    }

    return {
      status: 'error',
      error: toolCallResult?.error ?? 'Tool execution failed',
      ...(toolCallResult?.summary ? { summary: toolCallResult?.summary } : {}),
    };
  }
}
