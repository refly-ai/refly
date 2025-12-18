import { StructuredTool } from '@langchain/core/tools';
import type { ISkillEngine } from '@refly/common-types';
import { ReflyService } from './builtin/interface';
import { DriveFile } from '@refly/openapi-schema';

/**
 * Type of tool for post-processing selection
 */
export type ToolType =
  | 'builtin'
  | 'regular'
  | 'dynamic'
  | 'composio'
  | 'mcp'
  | 'config_based'
  | 'external_api'
  | 'external_oauth';

export interface ToolCallResult {
  /**
   * Status of the tool call result
   */
  status: 'success' | 'error';
  /**
   * Data of the tool call result, should be JSON serializable
   */
  data?: any;
  /**
   * Error message of the tool call result
   */
  error?: string;
  /**
   * Summary of the tool call result, should be human readable
   */
  summary?: string;
  /**
   * Credit cost calculated by the tool call. Optional and tool-specific.
   */
  creditCost?: number;
  /**
   * Files of the tool call result, should be an array of DriveFile
   */
  files?: DriveFile[];
}

/**
 * A typed constructor interface for agent tools.
 * Supports both parameterless and parameterized constructors so that
 * tools that do not require params remain compatible.
 */
export type AgentToolConstructor<TParams> =
  | (new () => AgentBaseTool<TParams>)
  | (new (
      params: TParams,
    ) => AgentBaseTool<TParams>);

/**
 * A convenience alias for any agent tool constructor.
 */
export type AnyAgentToolConstructor = AgentToolConstructor<unknown>;

/**
 * Base class for all agent tools.
 *
 * TParams is the construction parameter type that a concrete tool expects.
 * For tools that do not need parameters, use `unknown` (default).
 */
export abstract class AgentBaseTool<TParams = unknown> extends StructuredTool {
  /**
   * The key of the toolset that this tool belongs to.
   * Used to retrieve the toolset instance from the database.
   */
  abstract toolsetKey: string;

  /**
   * The type of the tool for post-processing selection.
   * Defaults to 'regular' if not overridden.
   */
  toolType: ToolType = 'regular';

  /**
   * Provide a permissive constructor so tools can be instantiated with or without params.
   * This keeps compatibility with tools that do not define their own constructor.
   */
  constructor(_params?: TParams) {
    super();
  }
}

/**
 * Base class for a toolset that groups related tools under the same key.
 *
 * TParams is the construction parameter type shared by all tools of this toolset
 * (for example API keys, base urls, etc.).
 */
export abstract class AgentBaseToolset<TParams = unknown> {
  /**
   * The key of the toolset.
   * Used to retrieve the toolset instance from the database.
   */
  abstract toolsetKey: string;

  /**
   * Get the tools that belong to this toolset.
   * Tool constructors are typed to accept the shared params of this toolset.
   */
  abstract tools: readonly AgentToolConstructor<TParams>[];

  /**
   * The parameters of the toolset. Used when instantiating tools.
   * Kept optional to allow metadata-only usage (e.g. listing tools) without params.
   */
  protected params?: TParams;

  /**
   * Lazily created tool instances.
   */
  protected toolInstances: AgentBaseTool<TParams>[] = [];

  constructor(params?: TParams) {
    this.params = params;
  }

  /**
   * Initialize tools with the provided params and cache instances.
   * If instances already exist, they will be replaced.
   */
  initializeTools(params?: TParams): AgentBaseTool<TParams>[] {
    const effectiveParams = (params ?? this.params) as TParams | undefined;

    // Do not attempt to construct param-requiring tools without params.
    if (effectiveParams === undefined && (this.tools?.length ?? 0) > 0) {
      // Create parameterless instances where possible; for parameterized tools
      // defer instantiation until params are provided.
      this.toolInstances =
        this.tools
          ?.map((Ctor) => {
            try {
              const NoArgCtor = Ctor as new () => AgentBaseTool<TParams>;
              return new NoArgCtor();
            } catch {
              return undefined;
            }
          })
          ?.filter((tool): tool is AgentBaseTool<TParams> => tool != null) ?? [];
      return this.toolInstances;
    }

    this.toolInstances = (this.tools ?? [])
      .map((Ctor) => {
        const WithArgCtor = Ctor as new (p: TParams) => AgentBaseTool<TParams>;
        return new WithArgCtor(effectiveParams as TParams);
      })
      .filter((tool): tool is AgentBaseTool<TParams> => tool != null);

    return this.toolInstances;
  }

  /**
   * Get a tool instance by name. If tools are not initialized yet, try to
   * initialize them using existing params.
   */
  getToolInstance(name: string): AgentBaseTool<TParams> {
    if (!this.toolInstances?.length) {
      this.initializeTools();
    }

    const toolInstance = this.toolInstances?.find((tool) => tool?.name === name);
    if (!toolInstance) {
      throw new Error(`Tool instance ${name} not found`);
    }
    return toolInstance;
  }

  /**
   * Find the tool constructor by name without instantiation.
   */
  getToolConstructor(name: string): AgentToolConstructor<TParams> {
    const tools = this.tools ?? ([] as unknown as readonly AgentToolConstructor<TParams>[]);
    const ctor = tools.find((Ctor) => {
      try {
        // Try to peek the name from a temporary instance without params
        const NoArgCtor = Ctor as new () => AgentBaseTool<TParams>;
        const tmp = new NoArgCtor();
        return tmp?.name === name;
      } catch {
        // If paramless instantiation fails, fall back to checking the prototype name
        return (
          ((Ctor as unknown as { prototype?: { name?: string } })?.prototype?.name ?? '') === name
        );
      }
    });

    if (!ctor) {
      throw new Error(`Tool ${name} not found in toolset ${this.toolsetKey}`);
    }

    return ctor as AgentToolConstructor<TParams>;
  }
}
/**
 * BaseToolParams ReflyService is the Refly service instance.
 */
export interface BaseToolParams {
  reflyService?: ReflyService;
  /**
   * Whether the parent toolset is global; used for post-call credit deduction.
   */
  isGlobalToolset?: boolean;
  /**
   * SkillEngine instance for accessing LLM models and configuration.
   * Required for tools that need to make LLM calls (e.g., sandbox agent).
   *
   * @see {@link ISkillEngine} for the interface definition
   */
  engine?: ISkillEngine;
}
