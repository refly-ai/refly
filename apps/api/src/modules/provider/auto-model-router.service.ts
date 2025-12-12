import { Logger } from '@nestjs/common';
import { ProviderItem as ProviderItemModel } from '@prisma/client';
import { LLMModelConfig } from '@refly/openapi-schema';
import {
  isAutoModel,
  selectAutoModel,
  AUTO_MODEL_ROUTING_PRIORITY,
  safeParseJSON,
} from '@refly/utils';
import { ProviderItemNotFoundError } from '@refly/errors';

/**
 * Context for Auto model routing
 * Contains all the data needed for routing decisions
 */
export interface RouterContext {
  /**
   * LLM provider items available for the user
   * Pre-fetched by ProviderService.findProviderItemsByCategory(user, 'llm')
   */
  llmItems: ProviderItemModel[];

  /**
   * User identifier for logging purposes
   */
  userId: string;
}

/**
 * Auto model router for selecting the best available model
 * Instantiate with RouterContext and call route() to perform routing
 */
export class AutoModelRouter {
  private logger = new Logger(AutoModelRouter.name);

  constructor(private readonly context: RouterContext) {}

  /**
   * Route Auto model to the target model with monitoring metadata
   * If the input is not an Auto model, returns it unchanged
   *
   * @param chatItem The chat model item to potentially route
   * @returns The routed model item or original item
   * @throws ProviderItemNotFoundError if no suitable model is found
   */
  route(chatItem: ProviderItemModel): ProviderItemModel {
    if (!isAutoModel(chatItem.config)) {
      return chatItem;
    }

    const routedItem = this.findAvailableModel();

    this.logger.log(
      `Routed auto model to ${routedItem.name} (itemId: ${routedItem.itemId}) for user ${this.context.userId}`,
    );

    return routedItem;
  }

  /**
   * Find an available LLM provider item for Auto model routing
   * This method implements a three-tier priority system:
   * 1. Check AUTO_MODEL_ROUTING_RANDOM_LIST env var and randomly select from it
   * 2. Fallback to AUTO_MODEL_ROUTING_PRIORITY constant array
   * 3. Final fallback to the first available model
   * Reasoning models (capabilities.reasoning = true) are excluded
   *
   * @returns The selected provider item
   * @throws ProviderItemNotFoundError if no suitable model is found
   */
  private findAvailableModel(): ProviderItemModel {
    const { llmItems } = this.context;

    // Key: modelId, value: item
    const modelMap = new Map<string, ProviderItemModel>();
    for (const item of llmItems) {
      const config: LLMModelConfig = safeParseJSON(item.config);

      if (!config) {
        continue;
      }

      // Skip reasoning models
      if (config.capabilities?.reasoning === true) {
        continue;
      }

      if (config.modelId) {
        modelMap.set(config.modelId, item);
      }
    }

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
}
