import { Injectable, Logger } from '@nestjs/common';
import {
  AutoModelRoutingRule as AutoModelRoutingRuleModel,
  ProviderItem as ProviderItemModel,
} from '@prisma/client';
import { LLMModelConfig, ToolDefinition, GenericToolset } from '@refly/openapi-schema';
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
 * Match conditions for routing rules
 * All defined conditions must be satisfied simultaneously (AND logic)
 */
export interface MatchConditions {
  /**
   * Scene list. If request scene is in the list, matches.
   * e.g., ["copilot", "agent"]
   */
  scenes?: string[];

  /**
   * Mode list.
   * e.g., ["copilot_agent", "node_agent"]
   */
  modes?: string[];

  /**
   * Tool keywords list.
   * If any tool in the request contains any keyword, matches.
   * Used to identify complex tools (e.g., "search", "code_interpreter").
   */
  toolKeywords?: string[];

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
export type RoutingTarget =
  | { type: 'single'; modelId: string }
  | { type: 'random'; candidates: string[] }
  | { type: 'weighted'; candidates: { modelId: string; weight: number }[] };

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
   * Used by tool-based routing to check for specific tools
   */
  toolsets?: GenericToolset[];

  /**
   * Currently enabled tools list
   * Used by rule-based routing for tool keyword matching
   */
  availableTools?: ToolDefinition[];

  // ===== Default options =====
  /**
   * Original model ID (user selected or system default)
   */
  originalModelId?: string;
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
    name: string;
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
   * Get rules from database (no caching for easier testing)
   */
  private async getRulesAsync(): Promise<AutoModelRoutingRuleModel[]> {
    try {
      return await this.prisma.autoModelRoutingRule.findMany({
        where: {
          enabled: true,
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
   * (e.g., external callers might incorrectly pass 'chat' as scene)
   *
   * @param chatItem The chat model item to potentially route
   * @param context The routing context
   * @returns Routing result with selected model and metadata
   */
  async route(chatItem: ProviderItemModel, context: RoutingContext): Promise<RoutingResult> {
    const routingResultId = uuidv4();

    // If not an Auto model, return unchanged
    if (!isAutoModel(chatItem.config)) {
      return {
        providerItem: chatItem,
        routingResultId,
        strategy: 'fallback',
      };
    }

    // Derive scene from mode internally (instead of trusting external scene parameter)
    const scene = this.deriveSceneFromMode(context.mode);

    // Build model map for routing
    const modelMap = this.buildModelMap(context.llmItems);

    // Priority 1: Try rule-based routing first
    const ruleResult = await this.routeByRules(context, modelMap, scene);
    if (ruleResult) {
      // Log routing result asynchronously (fire and forget)
      this.logRoutingResult(routingResultId, context, ruleResult, 'rule_based', scene).catch(
        (err) => this.logger.warn('Failed to log routing result', err),
      );

      this.logger.log(
        `Rule-based routing: ${ruleResult.matchedRule.name} -> ${ruleResult.providerItem.name}`,
      );

      return {
        providerItem: ruleResult.providerItem,
        routingResultId,
        strategy: 'rule_based',
        matchedRule: ruleResult.matchedRule,
      };
    }

    // Priority 2: Try tool-based routing (temporary solution)
    const toolBasedItem = this.tryToolBasedRouting(context, modelMap, scene);
    if (toolBasedItem) {
      // Log tool-based routing result asynchronously
      this.logRoutingResult(
        routingResultId,
        context,
        { providerItem: toolBasedItem },
        'tool_based',
        scene,
      ).catch((err) => this.logger.warn('Failed to log routing result', err));

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

    // Log fallback routing result asynchronously
    this.logRoutingResult(
      routingResultId,
      context,
      { providerItem: fallbackItem },
      strategy,
      scene,
    ).catch((err) => this.logger.warn('Failed to log routing result', err));

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
   */
  private async routeByRules(
    context: RoutingContext,
    modelMap: Map<string, ProviderItemModel>,
    scene?: string,
  ): Promise<{
    providerItem: ProviderItemModel;
    matchedRule: { ruleId: string; name: string };
  } | null> {
    const rules = await this.getRulesAsync();

    for (const rule of rules) {
      const matchConditions = safeParseJSON(rule.match) as MatchConditions;
      const target = safeParseJSON(rule.target) as RoutingTarget;

      if (!matchConditions || !target) {
        continue;
      }

      if (this.matchRule(matchConditions, context, scene)) {
        const selectedModel = this.selectModelFromTarget(target, modelMap);
        if (selectedModel) {
          return {
            providerItem: selectedModel,
            matchedRule: {
              ruleId: rule.ruleId,
              name: rule.name,
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
   */
  private matchRule(conditions: MatchConditions, context: RoutingContext, scene?: string): boolean {
    // Match scenes
    if (conditions.scenes && conditions.scenes.length > 0) {
      if (!scene || !conditions.scenes.includes(scene)) {
        return false;
      }
    }

    // Match modes
    if (conditions.modes && conditions.modes.length > 0) {
      if (!context.mode || !conditions.modes.includes(context.mode)) {
        return false;
      }
    }

    // Match tool keywords
    if (conditions.toolKeywords && conditions.toolKeywords.length > 0) {
      if (!this.matchToolKeywords(conditions.toolKeywords, context.availableTools)) {
        return false;
      }
    }

    // Match input length
    if (conditions.inputLength) {
      const length = context.inputLength ?? 0;
      if (conditions.inputLength.min !== undefined && length < conditions.inputLength.min) {
        return false;
      }
      if (conditions.inputLength.max !== undefined && length > conditions.inputLength.max) {
        return false;
      }
    }

    // Match regex
    if (conditions.regex) {
      if (!this.matchRegex(conditions.regex, context.inputPrompt)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if any tool matches the keywords
   */
  private matchToolKeywords(keywords: string[], tools?: ToolDefinition[]): boolean {
    if (!tools || tools.length === 0) {
      return false;
    }

    const keywordsLower = keywords.map((k) => k.toLowerCase());

    for (const tool of tools) {
      const toolName = tool.name?.toLowerCase() ?? '';

      // Get description from descriptionDict (try 'en' first, then first available)
      let toolDesc = '';
      if (tool.descriptionDict) {
        const desc = tool.descriptionDict.en ?? Object.values(tool.descriptionDict)[0];
        if (typeof desc === 'string') {
          toolDesc = desc.toLowerCase();
        }
      }

      for (const keyword of keywordsLower) {
        if (toolName.includes(keyword) || toolDesc.includes(keyword)) {
          return true;
        }
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
    switch (target.type) {
      case 'single': {
        return modelMap.get(target.modelId) ?? null;
      }

      case 'random': {
        const availableCandidates = target.candidates.filter((id) => modelMap.has(id));
        if (availableCandidates.length === 0) {
          return null;
        }
        const randomIndex = Math.floor(Math.random() * availableCandidates.length);
        return modelMap.get(availableCandidates[randomIndex]) ?? null;
      }

      case 'weighted': {
        const availableCandidates = target.candidates.filter((c) => modelMap.has(c.modelId));
        if (availableCandidates.length === 0) {
          return null;
        }

        const totalWeight = availableCandidates.reduce((sum, c) => sum + c.weight, 0);
        let random = Math.random() * totalWeight;

        for (const candidate of availableCandidates) {
          random -= candidate.weight;
          if (random <= 0) {
            return modelMap.get(candidate.modelId) ?? null;
          }
        }

        // Fallback to first candidate
        return modelMap.get(availableCandidates[0].modelId) ?? null;
      }

      default:
        return null;
    }
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
    result: { providerItem: ProviderItemModel; matchedRule?: { ruleId: string; name: string } },
    strategy: 'rule_based' | 'tool_based' | 'fallback' | 'random',
    scene?: string,
  ): Promise<void> {
    const config = safeParseJSON(result.providerItem.config) as LLMModelConfig;

    await this.prisma.autoModelRoutingResult.create({
      data: {
        routingResultId,
        userId: context.userId,
        scene,
        mode: context.mode,
        skillName: context.skillName,
        estimatedInputTokens: context.inputLength,
        routingStrategy: strategy,
        matchedRuleId: result.matchedRule?.ruleId,
        matchedRuleName: result.matchedRule?.name,
        selectedModelId: config?.modelId ?? result.providerItem.itemId,
        originalModelId: context.originalModelId,
      },
    });
  }
}
