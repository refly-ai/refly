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
  genRoutingResultID,
} from '@refly/utils';
import { ProviderItemNotFoundError } from '@refly/errors';
import { PrismaService } from '../common/prisma.service';

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
  RULE_BASED = 'rule_based',
  TOOL_BASED = 'tool_based',
  FALLBACK_RANDOM_SELECTION = 'fallback_random_selection',
  FALLBACK_BUILT_IN_PRIORITY = 'fallback_built_in_priority',
  FALLBACK_FIRST_AVAILABLE = 'fallback_first_available',
}

/**
 * Routing target definition
 */
export interface RoutingTarget {
  model: string;
}

/**
 * Result of rule-based routing
 */
export interface RuleRouteResult {
  providerItem: ProviderItemModel;
  matchedRule: { ruleId: string; ruleName: string };
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
 * Rule-based router that handles rule matching and selection
 * Encapsulates all rule-based routing logic without external dependencies
 */
class RuleRouter {
  constructor(private readonly context: RoutingContext) {}

  route(
    rules: AutoModelRoutingRuleModel[],
    modelMap: Map<string, ProviderItemModel>,
  ): RuleRouteResult | null {
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
   * 1. Rule-based routing (from database)
   * 2. Tool-based routing (from environment variables)
   * 3. Random selection (from environment variables)
   * 4. Built-in priority list (from code literals)
   * 5. Fallback to the first available model
   *
   * @param originalProviderItem The original provider item to potentially route
   * @param context The routing context
   * @param externalScene External scene value for validation (routing result is saved only if it matches derived scene)
   * @returns The selected provider item, or the original provider item if no routing is performed
   */
  async route(
    originalProviderItem: ProviderItemModel,
    context: RoutingContext,
    externalScene: string,
  ): Promise<ProviderItemModel> {
    // Return unchanged if not an Auto model
    if (!isAutoModel(originalProviderItem.config)) {
      return originalProviderItem;
    }

    // Check if derived scene matches external scene for saving routing result
    const derivedScene = this.deriveSceneFromMode(context.mode);
    const shouldSaveRoutingResult = derivedScene === externalScene;

    const modelMap = this.buildModelMap(context.llmItems);
    const routingResultId = genRoutingResultID();

    // Priority 1: Rule-based routing
    const ruleResult = await this.routeByRules(context, modelMap, derivedScene);
    if (ruleResult) {
      if (shouldSaveRoutingResult) {
        this.saveRoutingResult(
          context,
          routingResultId,
          derivedScene,
          RoutingStrategy.RULE_BASED,
          ruleResult.providerItem,
          originalProviderItem,
          ruleResult.matchedRule,
        );
      }

      return ruleResult.providerItem;
    }

    // Priority 2: Tool-based routing
    const toolBasedItem = this.routeByTools(context, modelMap, derivedScene);
    if (toolBasedItem) {
      if (shouldSaveRoutingResult) {
        this.saveRoutingResult(
          context,
          routingResultId,
          derivedScene,
          RoutingStrategy.TOOL_BASED,
          toolBasedItem,
          originalProviderItem,
        );
      }
      return toolBasedItem;
    }

    // Priority 3: Random selection
    const randomSelectedItem = this.routeByRandomSelection(modelMap);
    if (randomSelectedItem) {
      if (shouldSaveRoutingResult) {
        this.saveRoutingResult(
          context,
          routingResultId,
          derivedScene,
          RoutingStrategy.FALLBACK_RANDOM_SELECTION,
          randomSelectedItem,
          originalProviderItem,
        );
      }
      return randomSelectedItem;
    }

    // Priority 4: Built-in priority list
    const prioritySelectedItem = this.routeByBuiltInPriorityList(modelMap);
    if (prioritySelectedItem) {
      if (shouldSaveRoutingResult) {
        this.saveRoutingResult(
          context,
          routingResultId,
          derivedScene,
          RoutingStrategy.FALLBACK_BUILT_IN_PRIORITY,
          prioritySelectedItem,
          originalProviderItem,
        );
      }
      return prioritySelectedItem;
    }

    // Priority 5: Fallback to the first available model
    if (context.llmItems.length > 0) {
      const fallbackItem = context.llmItems[0];

      if (shouldSaveRoutingResult) {
        this.saveRoutingResult(
          context,
          routingResultId,
          derivedScene,
          RoutingStrategy.FALLBACK_FIRST_AVAILABLE,
          fallbackItem,
          originalProviderItem,
        );
      }

      return fallbackItem;
    }

    throw new ProviderItemNotFoundError('Auto model routing failed: no model available');
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
   * Rule-based routing
   * Rules are filtered by scene column and then matched by additional conditions
   */
  private async routeByRules(
    context: RoutingContext,
    modelMap: Map<string, ProviderItemModel>,
    scene: string,
  ): Promise<RuleRouteResult | null> {
    const rules = await this.getRules(scene);
    const ruleRouter = new RuleRouter(context);
    return ruleRouter.route(rules, modelMap);
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
   * Tool-based routing
   * This implements the temporary tool-based routing strategy controlled by environment variables
   *
   * @param context The routing context
   * @param modelMap Map of available models (modelId -> ProviderItem)
   * @param scene The derived scene for this routing
   * @returns The selected provider item, or null if tool-based routing should not be applied
   */
  private routeByTools(
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
      return null;
    }

    return targetModel;
  }

  /**
   * Select a model from the random list defined in AUTO_MODEL_ROUTING_PRIORITY
   */
  private routeByRandomSelection(
    modelMap: Map<string, ProviderItemModel>,
  ): ProviderItemModel | null {
    const selectedCandidate = selectAutoModel();
    if (!selectedCandidate) {
      return null;
    }

    const item = modelMap.get(selectedCandidate);
    if (!item) {
      return null;
    }

    return item;
  }

  /**
   * Select a model from the built-in priority list
   */
  private routeByBuiltInPriorityList(
    modelMap: Map<string, ProviderItemModel>,
  ): ProviderItemModel | null {
    for (const candidateModelId of AUTO_MODEL_ROUTING_PRIORITY) {
      const item = modelMap.get(candidateModelId);
      if (item) {
        return item;
      }
    }

    return null;
  }

  private saveRoutingResult(
    context: RoutingContext,
    routingResultId: string,
    scene: string,
    strategy: RoutingStrategy,
    selectedProviderItem: ProviderItemModel,
    originalProviderItem: ProviderItemModel,
    matchedRule?: { ruleId: string; ruleName: string },
  ) {
    this.saveRoutingResultAsync(
      context,
      routingResultId,
      scene,
      strategy,
      selectedProviderItem,
      originalProviderItem,
      matchedRule,
    ).catch((err) => this.logger.warn('Failed to save routing result', err));
  }

  /**
   * Save routing result to database (async, non-blocking)
   */
  private async saveRoutingResultAsync(
    context: RoutingContext,
    routingResultId: string,
    scene: string,
    strategy: RoutingStrategy,
    selectedProviderItem: ProviderItemModel,
    originalProviderItem: ProviderItemModel,
    matchedRule?: { ruleId: string; ruleName: string },
  ): Promise<void> {
    await this.prisma.autoModelRoutingResult.create({
      data: {
        routingResultId,
        userId: context.userId,
        actionResultId: context.actionResultId,
        actionResultVersion: context.actionResultVersion,
        scene,
        routingStrategy: strategy,
        matchedRuleId: matchedRule?.ruleId,
        matchedRuleName: matchedRule?.ruleName,
        originalItemId: originalProviderItem.itemId,
        originalModelId: this.getModelIdFromProviderItem(originalProviderItem),
        selectedItemId: selectedProviderItem.itemId,
        selectedModelId: this.getModelIdFromProviderItem(selectedProviderItem),
      },
    });
  }

  private getModelIdFromProviderItem(providerItem: ProviderItemModel): string | null {
    const config = safeParseJSON(providerItem.config) as LLMModelConfig;
    if (!config) {
      return null;
    }
    return config.modelId;
  }
}
