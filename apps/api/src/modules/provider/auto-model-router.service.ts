import { Injectable, Logger } from '@nestjs/common';
import {
  AutoModelRoutingRule as AutoModelRoutingRuleModel,
  ProviderItem as ProviderItemModel,
} from '@prisma/client';
import { LLMModelConfig, GenericToolset } from '@refly/openapi-schema';
import {
  isAutoModel,
  selectAutoModel,
  AUTO_MODEL_ROUTING_PRIORITY,
  safeParseJSON,
  getToolBasedRoutingConfig,
} from '@refly/utils';
import { ProviderItemNotFoundError } from '@refly/errors';
import { PrismaService } from '../common/prisma.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Condition for routing rules
 * All defined conditions must be satisfied simultaneously (AND logic)
 * Note: Scene matching is done via the rule's `scene` column, not in conditions
 */
export interface RuleCondition {
  /**
   * Toolset inventory keys list.
   * If any toolset in the request has an inventory key matching any in this list, matches.
   * Used for matching specific toolsets like "fal_image", "fal_video", etc.
   */
  toolsetInventoryKeys?: string[];
}

export enum RoutingStrategy {
  RULE_BASED = 'rule_based', // Rule-based routing
  TOOL_BASED = 'tool_based', // Tool-based routing
  FALLBACK = 'fallback', // Fallback to legacy routing
}

/**
 * Routing target definition
 */
export interface RoutingTarget {
  model: string;
}

/**
 * Context for Auto model routing
 * Contains all the data needed for routing decisions
 */
export interface RoutingContext {
  /**
   * LLM provider items available for the user
   * Pre-fetched by ProviderService.findProviderItemsByCategory(user, 'llm')
   */
  llmItems: ProviderItemModel[];

  /**
   * User identifier
   */
  userId: string;

  /**
   * Action result ID (for associating routing decision with execution result)
   */
  actionResultId?: string;

  /**
   * Action result version (combined with actionResultId for unique identification)
   */
  actionResultVersion?: number;

  /**
   * Mode (e.g., 'copilot_agent', 'node_agent')
   */
  mode?: string;

  /**
   * User original input (for regex matching, note: not stored for privacy)
   */
  inputPrompt?: string;

  /**
   * Toolsets selected for the skill invocation
   * Used for tool-based routing to check for specific tools
   */
  toolsets?: GenericToolset[];
}

/**
 * Routing result returned by the router
 */
export interface RoutingResult {
  /**
   * Selected provider item
   */
  providerItem: ProviderItemModel;

  /**
   * Routing result ID for tracing
   */
  routingResultId: string;

  /**
   * Strategy used for routing
   */
  strategy: RoutingStrategy;

  /**
   * Matched rule (if any)
   */
  matchedRule?: {
    ruleId: string;
    ruleName: string;
  };
}

/**
 * Rule-based router that handles rule matching and selection
 * Encapsulates all rule-based routing logic without external dependencies
 */
class RuleRouter {
  private readonly logger = new Logger(RuleRouter.name);

  constructor(private readonly context: RoutingContext) {}

  route(
    rules: AutoModelRoutingRuleModel[],
    modelMap: Map<string, ProviderItemModel>,
  ): {
    providerItem: ProviderItemModel;
    matchedRule: { ruleId: string; ruleName: string };
  } | null {
    for (const rule of rules) {
      if (this.matchRule(rule)) {
        const target = safeParseJSON(rule.target) as RoutingTarget;
        if (!target) {
          continue;
        }

        const selectedModel = this.selectModelFromTarget(target, modelMap);
        if (selectedModel) {
          return {
            providerItem: selectedModel,
            matchedRule: {
              ruleId: rule.ruleId,
              ruleName: rule.ruleName,
            },
          };
        }
      }
    }

    return null;
  }

  private matchRule(rule: AutoModelRoutingRuleModel): boolean {
    const condition = safeParseJSON(rule.condition) as RuleCondition;
    return this.matchCondition(condition);
  }

  /**
   * Check if context matches rule conditions
   * All defined conditions must be satisfied (AND logic)
   * Note: Scene matching is done at the database query level via the `scene` column
   */
  private matchCondition(condition?: RuleCondition): boolean {
    // condition can be empty (matches all requests for this scene)
    if (!condition) {
      return true;
    }

    // Match toolset inventory keys
    if (condition.toolsetInventoryKeys && condition.toolsetInventoryKeys.length > 0) {
      if (!this.matchToolsetInventoryKeys(condition.toolsetInventoryKeys)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if any toolset inventory key matches the provided keys
   * This is used for matching specific toolsets like "fal_image", "fal_video", etc.
   */
  private matchToolsetInventoryKeys(inventoryKeys: string[]): boolean {
    const toolsets = this.context.toolsets;
    if (!toolsets || toolsets.length === 0) {
      return false;
    }

    const keysSet = new Set(inventoryKeys);

    for (const toolset of toolsets) {
      const inventoryKey = toolset.toolset?.key;
      if (inventoryKey && keysSet.has(inventoryKey)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Select a model based on target configuration
   */
  private selectModelFromTarget(
    target: RoutingTarget,
    modelMap: Map<string, ProviderItemModel>,
  ): ProviderItemModel | null {
    return modelMap.get(target.model) ?? null;
  }
}

/**
 * Auto model routing service for rule-based model selection
 * This service loads rules from the database and performs synchronous routing decisions
 */
@Injectable()
export class AutoModelRoutingService {
  private readonly logger = new Logger(AutoModelRoutingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derive scene from mode
   * This ensures consistent scene mapping based on the mode value
   *
   * @param mode The mode string (e.g., 'copilot_agent', 'node_agent')
   * @returns The derived scene (e.g., 'copilot', 'agent', 'chat')
   */
  private deriveSceneFromMode(mode?: string): string {
    if (!mode) {
      return 'chat';
    }

    // Map mode to scene
    if (mode.includes('copilot')) {
      return 'copilot';
    }

    if (mode.includes('agent')) {
      return 'agent';
    }

    // Default fallback
    return 'chat';
  }

  /**
   * Route Auto model to the target model based on rules
   * This method implements a multi-tier priority system:
   * 1. Rule-based routing (from database rules)
   * 2. Tool-based routing (if enabled and conditions are met)
   * 3. Legacy routing (random list or priority list)
   * If the input is not an Auto model, returns it unchanged
   *
   * Note: Scene is derived from mode internally to avoid unreliable external scene values
   * (e.g., external callers might incorrectly pass 'chat' as scene).
   * The external scene parameter is only used for validation: routing results are logged
   * only when the derived scene matches the external scene.
   *
   * @param chatItem The chat model item to potentially route
   * @param context The routing context
   * @param externalScene External scene value for validation (routing result is logged only if it matches derived scene)
   * @returns Routing result with selected model and metadata
   */
  async route(
    chatItem: ProviderItemModel,
    context: RoutingContext,
    externalScene: string,
  ): Promise<RoutingResult> {
    const routingResultId = uuidv4();

    // Extract original item and model IDs from the input chatItem (original provider item)
    const originalItemId = chatItem.itemId;
    const originalConfig = safeParseJSON(chatItem.config) as LLMModelConfig;
    const originalModelId = originalConfig?.modelId ?? chatItem.itemId;

    // If not an Auto model, return unchanged
    if (!isAutoModel(chatItem.config)) {
      return {
        providerItem: chatItem,
        routingResultId,
        strategy: RoutingStrategy.FALLBACK,
      };
    }

    // Derive scene from mode internally (instead of trusting external scene parameter)
    const derivedScene = this.deriveSceneFromMode(context.mode);

    // Check if derived scene matches external scene for logging
    const shouldSaveRoutingResult = derivedScene === externalScene;

    // Build model map for routing
    const modelMap = this.buildModelMap(context.llmItems);

    // Priority 1: Try rule-based routing first
    const ruleResult = await this.routeByRules(context, modelMap, derivedScene);
    if (ruleResult) {
      // Log routing result asynchronously only if scenes match
      if (shouldSaveRoutingResult) {
        this.saveRoutingResult(
          routingResultId,
          context,
          ruleResult,
          RoutingStrategy.RULE_BASED,
          originalItemId,
          originalModelId,
          derivedScene,
        ).catch((err) => this.logger.warn('Failed to log routing result', err));
      }

      this.logger.log(
        `Rule-based routing: ${ruleResult.matchedRule.ruleName} -> ${ruleResult.providerItem.name}`,
      );

      return {
        providerItem: ruleResult.providerItem,
        routingResultId,
        strategy: RoutingStrategy.RULE_BASED,
        matchedRule: ruleResult.matchedRule,
      };
    }

    // Priority 2: Try tool-based routing (temporary solution)
    const toolBasedItem = this.tryToolBasedRouting(context, modelMap, derivedScene);
    if (toolBasedItem) {
      // Log tool-based routing result asynchronously only if scenes match
      if (shouldSaveRoutingResult) {
        this.saveRoutingResult(
          routingResultId,
          context,
          { providerItem: toolBasedItem },
          RoutingStrategy.TOOL_BASED,
          originalItemId,
          originalModelId,
          derivedScene,
        ).catch((err) => this.logger.warn('Failed to log routing result', err));
      }

      this.logger.log(
        `Tool-based routing: ${toolBasedItem.name} (itemId: ${toolBasedItem.itemId}) for user ${context.userId}`,
      );

      return {
        providerItem: toolBasedItem,
        routingResultId,
        strategy: RoutingStrategy.TOOL_BASED,
      };
    }

    // Priority 3: Fallback to legacy routing
    const fallbackItem = this.findAvailableModelLegacy(context.llmItems, modelMap);
    const strategy = RoutingStrategy.FALLBACK;

    // Save routing result only if scenes match
    if (shouldSaveRoutingResult) {
      this.saveRoutingResult(
        routingResultId,
        context,
        { providerItem: fallbackItem },
        strategy,
        originalItemId,
        originalModelId,
        derivedScene,
      ).catch((err) => this.logger.warn('Failed to log routing result', err));
    }

    this.logger.log(
      `${strategy} routing: ${fallbackItem.name} (itemId: ${fallbackItem.itemId}) for user ${context.userId}`,
    );

    return {
      providerItem: fallbackItem,
      routingResultId,
      strategy,
    };
  }

  /**
   * Get rules from database filtered by scene (no caching for easier testing)
   */
  private async getRules(scene: string): Promise<AutoModelRoutingRuleModel[]> {
    try {
      return await this.prisma.autoModelRoutingRule.findMany({
        where: {
          enabled: true,
          scene,
          deletedAt: null,
        },
        orderBy: {
          priority: 'desc',
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to fetch rules for scene ${scene}`, error);
      return [];
    }
  }

  /**
   * Route by database rules (delegates to RuleRouter)
   * Rules are filtered by scene column and then matched by additional conditions
   */
  private async routeByRules(
    context: RoutingContext,
    modelMap: Map<string, ProviderItemModel>,
    scene: string,
  ): Promise<{
    providerItem: ProviderItemModel;
    matchedRule: { ruleId: string; ruleName: string };
  } | null> {
    const rules = await this.getRules(scene);
    const ruleRouter = new RuleRouter(context);
    return ruleRouter.route(rules, modelMap);
  }

  /**
   * Build a map of modelId -> ProviderItemModel
   * Filters out invalid configs and reasoning models
   */
  private buildModelMap(items: ProviderItemModel[]): Map<string, ProviderItemModel> {
    const modelMap = new Map<string, ProviderItemModel>();

    for (const item of items) {
      const config = safeParseJSON(item.config) as LLMModelConfig;
      if (!config) continue;
      // Exclude reasoning models from routing
      if (config.capabilities?.reasoning === true) continue;
      if (config.modelId) {
        modelMap.set(config.modelId, item);
      }
    }

    return modelMap;
  }

  /**
   * Legacy fallback routing logic
   * Keeps backward compatibility with existing behavior
   */
  private findAvailableModelLegacy(
    llmItems: ProviderItemModel[],
    modelMap: Map<string, ProviderItemModel>,
  ): ProviderItemModel {
    // Priority 1: Try to select a model from the random list
    const selectedCandidate = selectAutoModel();
    if (selectedCandidate) {
      const item = modelMap.get(selectedCandidate);
      if (item) {
        return item;
      }
    }

    // Priority 2: Fallback to AUTO_MODEL_ROUTING_PRIORITY list
    for (const candidateModelId of AUTO_MODEL_ROUTING_PRIORITY) {
      const item = modelMap.get(candidateModelId);
      if (item) {
        return item;
      }
    }

    // Priority 3: the first available model
    if (llmItems.length > 0) {
      return llmItems[0];
    }

    throw new ProviderItemNotFoundError('Auto model routing failed: no model available');
  }

  /**
   * Try tool-based routing logic
   * This implements the temporary tool-based routing strategy controlled by environment variables
   *
   * @param context The routing context
   * @param modelMap Map of available models (modelId -> ProviderItem)
   * @param scene The derived scene for this routing
   * @returns The selected provider item, or null if tool-based routing should not be applied
   */
  private tryToolBasedRouting(
    context: RoutingContext,
    modelMap: Map<string, ProviderItemModel>,
    scene?: string,
  ): ProviderItemModel | null {
    // Tool-based routing is only applicable when mode is 'node_agent' and scene is 'agent'
    if (context.mode !== 'node_agent') {
      return null;
    }

    if (scene !== 'agent') {
      return null;
    }

    const config = getToolBasedRoutingConfig();
    if (!config.enabled) {
      return null;
    }

    const toolKeysSet = new Set(
      context.toolsets?.map((t) => t.toolset?.key).filter((key): key is string => !!key) ?? [],
    );

    const hasTargetTool = config.targetTools.some((targetTool) => toolKeysSet.has(targetTool));

    const targetModelId = hasTargetTool ? config.matchedModelId : config.unmatchedModelId;
    if (!targetModelId) {
      return null;
    }

    const targetModel = modelMap.get(targetModelId);

    if (!targetModel) {
      this.logger.warn(
        `[AutoModelRouter] Tool-based routing fallback: target model '${targetModelId}' not available for user ${context.userId}`,
      );
      return null;
    }

    this.logger.log(
      `[AutoModelRouter] Tool-based routing applied: tools ${hasTargetTool ? 'matched' : 'unmatched'}, ` +
        `routing to ${targetModel.name} (modelId: ${targetModelId})`,
    );
    return targetModel;
  }

  /**
   * Log routing result to database (async, non-blocking)
   */
  private async saveRoutingResult(
    routingResultId: string,
    context: RoutingContext,
    result: { providerItem: ProviderItemModel; matchedRule?: { ruleId: string; ruleName: string } },
    strategy: RoutingStrategy,
    originalItemId: string,
    originalModelId: string,
    scene?: string,
  ): Promise<void> {
    const config = safeParseJSON(result.providerItem.config) as LLMModelConfig;

    await this.prisma.autoModelRoutingResult.create({
      data: {
        routingResultId,
        userId: context.userId,
        actionResultId: context.actionResultId,
        actionResultVersion: context.actionResultVersion,
        scene,
        routingStrategy: strategy,
        matchedRuleId: result.matchedRule?.ruleId,
        matchedRuleName: result.matchedRule?.ruleName,
        selectedItemId: result.providerItem.itemId,
        selectedModelId: config?.modelId ?? result.providerItem.itemId,
        originalItemId,
        originalModelId,
      },
    });
  }
}
