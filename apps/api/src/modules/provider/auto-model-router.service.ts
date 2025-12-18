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

  /**
   * Input length limits (estimated tokens or characters).
   * Used to distinguish short tasks from long context tasks.
   */
  inputLength?: {
    min?: number;
    max?: number;
  };

  /**
   * Regex pattern.
   * Used to match specific instructions in User Prompt or System Prompt.
   */
  regex?: string;
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

  // ===== Association info =====
  /**
   * Action result ID (for associating routing decision with execution result)
   */
  actionResultId?: string;

  /**
   * Action result version (combined with actionResultId for unique identification)
   */
  actionResultVersion?: number;

  // ===== Task metadata =====
  /**
   * Mode (e.g., 'copilot_agent', 'node_agent')
   */
  mode?: string;

  /**
   * Skill name (e.g., 'summarize_page')
   */
  skillName?: string;

  // ===== Input features =====
  /**
   * User original input (for regex matching, note: not stored for privacy)
   */
  inputPrompt?: string;

  /**
   * Character count or estimated token count
   */
  inputLength?: number;

  // ===== Tool features =====
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
  strategy: 'rule_based' | 'tool_based' | 'fallback' | 'random';

  /**
   * Matched rule (if any)
   */
  matchedRule?: {
    ruleId: string;
    ruleName: string;
  };
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
   * Get rules from database filtered by scene (no caching for easier testing)
   */
  private async getRulesAsync(scene: string): Promise<AutoModelRoutingRuleModel[]> {
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
      this.logger.error('Failed to fetch rules', error);
      return [];
    }
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
        strategy: 'fallback',
      };
    }

    // Derive scene from mode internally (instead of trusting external scene parameter)
    const derivedScene = this.deriveSceneFromMode(context.mode);

    // Check if derived scene matches external scene for logging
    const shouldLogResult = derivedScene === externalScene;

    // Build model map for routing
    const modelMap = this.buildModelMap(context.llmItems);

    // Priority 1: Try rule-based routing first
    const ruleResult = await this.routeByRules(context, modelMap, derivedScene);
    if (ruleResult) {
      // Log routing result asynchronously only if scenes match
      if (shouldLogResult) {
        this.logRoutingResult(
          routingResultId,
          context,
          ruleResult,
          'rule_based',
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
        strategy: 'rule_based',
        matchedRule: ruleResult.matchedRule,
      };
    }

    // Priority 2: Try tool-based routing (temporary solution)
    const toolBasedItem = this.tryToolBasedRouting(context, modelMap, derivedScene);
    if (toolBasedItem) {
      // Log tool-based routing result asynchronously only if scenes match
      if (shouldLogResult) {
        this.logRoutingResult(
          routingResultId,
          context,
          { providerItem: toolBasedItem },
          'tool_based',
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
        strategy: 'tool_based',
      };
    }

    // Priority 3: Fallback to legacy routing
    const fallbackItem = this.findAvailableModelLegacy(context.llmItems, modelMap);
    const strategy = selectAutoModel() ? 'random' : 'fallback';

    // Log fallback routing result asynchronously only if scenes match
    if (shouldLogResult) {
      this.logRoutingResult(
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
   * Route by database rules
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
    const rules = await this.getRulesAsync(scene);

    for (const rule of rules) {
      const condition = safeParseJSON(rule.condition) as RuleCondition;
      const target = safeParseJSON(rule.target) as RoutingTarget;

      if (!target) {
        continue;
      }

      // condition can be empty (matches all requests for this scene)
      if (this.matchRule(condition ?? {}, context)) {
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

  /**
   * Check if context matches rule conditions
   * All defined conditions must be satisfied (AND logic)
   * Note: Scene matching is done at the database query level via the `scene` column
   */
  private matchRule(condition: RuleCondition, context: RoutingContext): boolean {
    // Match toolset inventory keys
    if (condition.toolsetInventoryKeys && condition.toolsetInventoryKeys.length > 0) {
      if (!this.matchToolsetInventoryKeys(condition.toolsetInventoryKeys, context.toolsets)) {
        return false;
      }
    }

    // Match input length
    if (condition.inputLength) {
      const length = context.inputLength ?? 0;
      if (condition.inputLength.min !== undefined && length < condition.inputLength.min) {
        return false;
      }
      if (condition.inputLength.max !== undefined && length > condition.inputLength.max) {
        return false;
      }
    }

    // Match regex
    if (condition.regex) {
      if (!this.matchRegex(condition.regex, context.inputPrompt)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if any toolset inventory key matches the provided keys
   * This is used for matching specific toolsets like "fal_image", "fal_video", etc.
   */
  private matchToolsetInventoryKeys(inventoryKeys: string[], toolsets?: GenericToolset[]): boolean {
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
   * Check if input matches regex pattern
   */
  private matchRegex(pattern: string, input?: string): boolean {
    if (!input) {
      return false;
    }

    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(input);
    } catch {
      this.logger.warn(`Invalid regex pattern: ${pattern}`);
      return false;
    }
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
   * Select a model based on target configuration
   */
  private selectModelFromTarget(
    target: RoutingTarget,
    modelMap: Map<string, ProviderItemModel>,
  ): ProviderItemModel | null {
    return modelMap.get(target.model) ?? null;
  }

  /**
   * Legacy fallback routing logic
   * Keeps backward compatibility with existing behavior
   */
  private findAvailableModelLegacy(
    llmItems: ProviderItemModel[],
    modelMap: Map<string, ProviderItemModel>,
  ): ProviderItemModel {
    // Priority 1: Try random selection from env var
    const selectedCandidate = selectAutoModel();
    if (selectedCandidate) {
      const item = modelMap.get(selectedCandidate);
      if (item) {
        return item;
      }
    }

    // Priority 2: Fallback to priority list
    for (const candidateModelId of AUTO_MODEL_ROUTING_PRIORITY) {
      const item = modelMap.get(candidateModelId);
      if (item) {
        return item;
      }
    }

    // Priority 3: First available model
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
  private async logRoutingResult(
    routingResultId: string,
    context: RoutingContext,
    result: { providerItem: ProviderItemModel; matchedRule?: { ruleId: string; ruleName: string } },
    strategy: 'rule_based' | 'tool_based' | 'fallback' | 'random',
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
