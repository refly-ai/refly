import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  BatchUpsertProviderItemsRequest,
  DefaultModelConfig,
  DeleteProviderItemRequest,
  DeleteProviderRequest,
  EmbeddingModelConfig,
  ListProviderItemOptionsData,
  ListProviderItemsData,
  ListProvidersData,
  LLMModelConfig,
  ModelScene,
  ModelTier,
  ProviderCategory,
  ProviderItemOption,
  RerankerModelConfig,
  UpsertProviderItemRequest,
  UpsertProviderRequest,
  User,
  UserPreferences,
  MediaGenerationModelConfig,
} from '@refly/openapi-schema';
import { Provider as ProviderModel, ProviderItem as ProviderItemModel } from '@prisma/client';
import {
  genProviderItemID,
  genProviderID,
  providerInfoList,
  safeParseJSON,
  deepmerge,
  runModuleInitWithTimeoutAndRetry,
} from '@refly/utils';
import {
  ProviderNotFoundError,
  ProviderItemNotFoundError,
  ParamsError,
  EmbeddingNotAllowedToChangeError,
  EmbeddingNotConfiguredError,
  ChatModelNotConfiguredError,
} from '@refly/errors';
import { SingleFlightCache } from '../../utils/cache';
import { EncryptionService } from '../common/encryption.service';
import pLimit from 'p-limit';
import {
  getEmbeddings,
  Embeddings,
  FallbackReranker,
  getReranker,
  getChatModel,
  initializeMonitoring,
  ProviderChecker,
  ProviderCheckResult,
} from '@refly/providers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ConfigService } from '@nestjs/config';
import { VectorSearchService } from '../common/vector-search';
import { VECTOR_SEARCH } from '../common/vector-search/tokens';
import { providerItemPO2DTO } from './provider.dto';
import { AutoModelRouter } from './auto-model-router.service';

interface GlobalProviderConfig {
  providers: ProviderModel[];
  items: (ProviderItemModel & { provider: ProviderModel })[];
}

const PROVIDER_ITEMS_BATCH_LIMIT = 50;

@Injectable()
export class ProviderService implements OnModuleInit {
  private logger = new Logger(ProviderService.name);
  private globalProviderCache: SingleFlightCache<GlobalProviderConfig>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VECTOR_SEARCH)
    private readonly vectorSearchService: VectorSearchService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.globalProviderCache = new SingleFlightCache(this.fetchGlobalProviderConfig.bind(this));
  }

  async onModuleInit() {
    await runModuleInitWithTimeoutAndRetry(
      async () => {
        const langfuseConfig = {
          publicKey: this.configService.get('langfuse.publicKey'),
          secretKey: this.configService.get('langfuse.secretKey'),
          baseUrl: this.configService.get('langfuse.baseUrl'),
          enabled: !!(
            this.configService.get('langfuse.publicKey') &&
            this.configService.get('langfuse.secretKey')
          ),
        };

        if (langfuseConfig.enabled) {
          initializeMonitoring(langfuseConfig);
          this.logger.log('Langfuse monitoring initialized successfully');
        } else {
          this.logger.warn('Langfuse monitoring disabled - missing configuration');
        }
      },
      {
        logger: this.logger,
        label: 'ProviderService.onModuleInit',
      },
    );

    // Initialize default embedding provider if none exists
    // await this.initializeDefaultEmbeddingProvider();
  }

  /**
   * Initialize default embedding provider if none exists
   */
  private async initializeDefaultEmbeddingProvider() {
    try {
      // Check if any embedding provider items exist
      const existingEmbeddingItems = await this.prisma.providerItem.findFirst({
        where: {
          category: 'embedding',
          deletedAt: null,
        },
      });

      if (existingEmbeddingItems) {
        this.logger.log('Embedding provider already exists, skipping initialization');
        return;
      }

      // Check if OpenAI provider exists
      let openaiProvider = await this.prisma.provider.findFirst({
        where: {
          providerKey: 'openai',
          isGlobal: true,
          deletedAt: null,
        },
      });

      // Create OpenAI provider if it doesn't exist
      if (!openaiProvider) {
        openaiProvider = await this.prisma.provider.create({
          data: {
            providerId: genProviderID(),
            providerKey: 'openai',
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            enabled: true,
            categories: 'llm,embedding',
            isGlobal: true,
            apiKey: this.encryptionService.encrypt(''), // Empty API key, user needs to configure
          },
        });
        this.logger.log(`Created default OpenAI provider ${openaiProvider.providerId}`);
      }

      // Create default embedding model item
      const embeddingItem = await this.prisma.providerItem.create({
        data: {
          itemId: genProviderItemID(),
          providerId: openaiProvider.providerId,
          category: 'embedding',
          name: 'text-embedding-3-small',
          enabled: true,
          config: JSON.stringify({
            model: 'text-embedding-3-small',
            dimensions: 1536,
          }),
          tier: 't2',
          order: 0,
          groupName: 'Default',
        },
      });

      this.logger.log(`Created default embedding model item ${embeddingItem.itemId}`);
    } catch (error) {
      this.logger.error('Failed to initialize default embedding provider:', error);
    }
  }

  async fetchGlobalProviderConfig(): Promise<GlobalProviderConfig> {
    const providers = await this.prisma.provider.findMany({
      where: {
        isGlobal: true,
        deletedAt: null,
      },
    });

    // Initialize searxng global provider if SEARXNG_BASE_URL is set
    if (process.env.SEARXNG_BASE_URL) {
      const searXngProvider = providers.find((provider) => provider.providerKey === 'searxng');
      if (!searXngProvider) {
        const provider = await this.prisma.provider.create({
          data: {
            providerId: genProviderID(),
            providerKey: 'searxng',
            name: 'SearXNG',
            baseUrl: process.env.SEARXNG_BASE_URL,
            enabled: true,
            categories: 'webSearch',
            isGlobal: true,
          },
        });
        this.logger.log(`Initialized global searxng provider ${provider.providerId}`);

        providers.push(provider);
      }
    }

    // Decrypt API keys for all providers
    const decryptedProviders = providers.map((provider) => ({
      ...provider,
      apiKey: this.encryptionService.decrypt(provider.apiKey),
    }));

    const items = await this.prisma.providerItem.findMany({
      where: {
        providerId: {
          in: providers.map((provider) => provider.providerId),
        },
        enabled: true,
        uid: null,
        deletedAt: null,
      },
      include: {
        provider: true,
      },
    });

    // Decrypt API keys for all providers included in items
    const decryptedItems = items.map((item) => ({
      ...item,
      provider: {
        ...item.provider,
        apiKey: this.encryptionService.decrypt(item.provider.apiKey),
      },
    }));

    return { providers: decryptedProviders, items: decryptedItems };
  }

  async findProvider(user: User, param: ListProvidersData['query']) {
    const { enabled, providerKey, category, isGlobal } = param;
    const provider = await this.prisma.provider.findFirst({
      where: {
        enabled,
        providerKey,
        deletedAt: null,
        ...(isGlobal ? { isGlobal: true } : { uid: user.uid }),
        ...(category ? { categories: { contains: category } } : {}),
      },
    });

    if (!provider) {
      return null;
    }

    // Encrypt API key before storing
    const decryptedApiKey = provider.apiKey
      ? this.encryptionService.decrypt(provider.apiKey)
      : null;

    return {
      ...provider,
      apiKey: decryptedApiKey,
    };
  }

  async listProviders(user: User, param: ListProvidersData['query']) {
    const { enabled, providerKey, category, isGlobal } = param;

    if (isGlobal) {
      const { providers } = await this.globalProviderCache.get();
      return providers.filter(
        (provider) =>
          (!providerKey || provider.providerKey === providerKey) &&
          (!category || provider.categories.includes(category)) &&
          (enabled === undefined || provider.enabled === enabled),
      );
    }

    const providers = await this.prisma.provider.findMany({
      where: {
        ...(isGlobal === false
          ? { uid: user.uid }
          : { OR: [{ uid: user.uid }, { isGlobal: true }] }),
        enabled,
        providerKey,
        deletedAt: null,
        ...(category ? { categories: { contains: category } } : {}),
      },
    });

    return providers;
  }

  async createProvider(user: User, param: UpsertProviderRequest) {
    const { providerKey, name, apiKey, baseUrl, enabled, categories = [] } = param;

    if (!providerKey || !name) {
      throw new ParamsError('Provider key and name are required');
    }

    // Find the provider info from providerInfoList
    const providerInfo = providerInfoList.find((info) => info.key === providerKey);
    if (!providerInfo) {
      throw new ParamsError(`Unknown provider key: ${providerKey}`);
    }

    // Validate fields based on fieldConfig
    const fieldErrors: string[] = [];

    // Check apiKey requirement
    if (providerInfo.fieldConfig.apiKey.presence === 'required' && !apiKey) {
      fieldErrors.push(`API key is required for ${providerInfo.name} provider`);
    }

    // Check baseUrl requirement
    if (providerInfo.fieldConfig.baseUrl.presence === 'required' && !baseUrl) {
      fieldErrors.push(`Base URL is required for ${providerInfo.name} provider`);
    }

    // Throw error if validation fails
    if (fieldErrors.length > 0) {
      throw new ParamsError(fieldErrors.join('; '));
    }

    const providerId = genProviderID();

    // Use default baseUrl if available and not provided
    const finalBaseUrl = baseUrl || providerInfo.fieldConfig.baseUrl?.defaultValue;

    // Encrypt API key before storing
    const encryptedApiKey = this.encryptionService.encrypt(apiKey);

    const provider = await this.prisma.provider.create({
      data: {
        providerId,
        providerKey,
        name,
        apiKey: encryptedApiKey,
        baseUrl: finalBaseUrl,
        enabled,
        categories: categories.join(','),
        uid: user.uid,
      },
    });

    // Return provider with decrypted API key
    return {
      ...provider,
      apiKey: this.encryptionService.decrypt(provider.apiKey),
    };
  }

  async updateProvider(user: User, param: UpsertProviderRequest) {
    const { providerId, providerKey, name, apiKey, baseUrl, enabled, categories } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.provider.findUnique({
      where: {
        providerId,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }
    if (provider.isGlobal) {
      throw new ParamsError('Global model provider cannot be updated');
    }

    // Only validate if providerKey is being updated
    if (providerKey) {
      // Find the provider info from providerInfoList
      const providerInfo = providerInfoList.find((info) => info.key === providerKey);
      if (!providerInfo) {
        throw new ParamsError(`Unknown provider key: ${providerKey}`);
      }

      // Validate fields based on fieldConfig
      const fieldErrors: string[] = [];

      // Check apiKey requirement
      if (providerInfo.fieldConfig.apiKey.presence === 'required' && apiKey === '') {
        fieldErrors.push(`API key is required for ${providerInfo.name} provider`);
      }

      // Check baseUrl requirement
      if (providerInfo.fieldConfig.baseUrl.presence === 'required' && baseUrl === '') {
        fieldErrors.push(`Base URL is required for ${providerInfo.name} provider`);
      }

      // Throw error if validation fails
      if (fieldErrors.length > 0) {
        throw new ParamsError(fieldErrors.join('; '));
      }
    }

    // Get the provider info for the current or updated provider key
    const providerInfo = providerInfoList.find(
      (info) => info.key === (providerKey || provider.providerKey),
    );
    // Use default baseUrl if available and not provided but required
    const finalBaseUrl =
      baseUrl !== undefined
        ? baseUrl
        : providerInfo?.fieldConfig.baseUrl?.defaultValue || provider.baseUrl;

    const finalCategories = categories || provider.categories.split(',');

    // Encrypt API key if provided
    const encryptedApiKey =
      apiKey !== undefined ? this.encryptionService.encrypt(apiKey) : undefined;

    const updatedProvider = await this.prisma.provider.update({
      where: {
        pk: provider.pk,
      },
      data: {
        providerKey,
        name,
        apiKey: encryptedApiKey,
        baseUrl: finalBaseUrl,
        categories: finalCategories.join(','),
        enabled,
      },
    });

    // Return provider with decrypted API key
    return {
      ...updatedProvider,
      apiKey: this.encryptionService.decrypt(updatedProvider.apiKey),
    };
  }

  async deleteProvider(user: User, param: DeleteProviderRequest) {
    const { providerId } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.provider.findUnique({
      where: {
        providerId,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }
    if (provider.isGlobal) {
      throw new ParamsError('Global model provider cannot be deleted');
    }

    return this.prisma.provider.update({
      where: {
        pk: provider.pk,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get user preferences from database or existing preference json config.
   */
  async getUserPreferences(user: User, preferenceJson?: string): Promise<UserPreferences> {
    const { uid } = user;
    const systemPreferences: UserPreferences = {
      providerMode: this.configService.get('provider.defaultMode'),
      defaultModel: await this.getGlobalDefaultModelConfig(),
    };

    try {
      let rawPreference = preferenceJson;
      if (!rawPreference) {
        const userPo = await this.prisma.user.findUnique({
          where: { uid },
          select: {
            preferences: true,
          },
        });
        rawPreference = userPo?.preferences;
      }

      if (!rawPreference) {
        return systemPreferences;
      }

      // System preferences should have higher priority
      return deepmerge(safeParseJSON(rawPreference), systemPreferences);
    } catch (error) {
      this.logger.warn(`Failed to get user preferences for ${uid}: ${error?.message || error}`);
      return systemPreferences;
    }
  }

  /**
   * Get user's configured media generation provider and model from default model settings
   */
  async getUserMediaConfig(
    user: User,
    mediaType: 'image' | 'audio' | 'video',
  ): Promise<{
    provider: string;
    providerItemId: string;
    model: string;
  } | null> {
    if (!mediaType) {
      return null;
    }

    try {
      // Get user's default model configuration from preferences
      const userPreferences = await this.getUserPreferences(user);
      const userDefaultModel = userPreferences?.defaultModel;

      // Get the specific media model configuration based on mediaType
      const mediaModelConfig = userDefaultModel?.[mediaType];

      // Find the provider item for this configured model
      const providerItems = await this.listProviderItems(user, {
        category: 'mediaGeneration',
        enabled: true,
      });

      let configuredProviderItem = providerItems.find(
        (item) => item.itemId === mediaModelConfig?.itemId,
      );

      if (!configuredProviderItem) {
        // Fallback: find an enabled model that supports the requested mediaType
        const fallbackProviderItem = providerItems.find((item) => {
          try {
            const config: MediaGenerationModelConfig = safeParseJSON(item.config || '{}');

            return config.capabilities?.[mediaType];
          } catch (error) {
            this.logger.warn(
              `Failed to parse config for provider item ${item.itemId}: ${error?.message}`,
            );
            return false;
          }
        });

        if (!fallbackProviderItem) {
          this.logger.warn(`No enabled ${mediaType} model found in user's provider items`);
          return null;
        }

        configuredProviderItem = fallbackProviderItem;
      }

      // Parse the model configuration
      const config: MediaGenerationModelConfig = safeParseJSON(
        configuredProviderItem.config || '{}',
      );

      this.logger.log(
        `Using user configured ${mediaType} model: ${config.modelId} from provider: ${configuredProviderItem.provider?.providerKey}`,
      );

      return {
        provider: configuredProviderItem.provider?.providerKey,
        providerItemId: configuredProviderItem.itemId,
        model: config.modelId,
      };
    } catch (error) {
      this.logger.warn(`Failed to get user media config: ${error?.message || error}`);
      return null;
    }
  }

  async listProviderItems(user: User, param: ListProviderItemsData['query']) {
    const { providerId, category, enabled, isGlobal } = param;

    if (isGlobal) {
      const { items: globalItems } = await this.globalProviderCache.get();
      return globalItems.filter(
        (item) =>
          (!providerId || item.providerId === providerId) &&
          (!category || item.category === category) &&
          (enabled === undefined || item.enabled === enabled),
      );
    }

    // Fetch user's provider items
    return this.prisma.providerItem.findMany({
      where: {
        ...(isGlobal === false ? { uid: user.uid } : { OR: [{ uid: user.uid }, { uid: null }] }),
        providerId,
        category,
        enabled,
        deletedAt: null,
      },
      include: {
        provider: true,
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  /**
   * Try to find credit billing config for user-specific provider items
   * @param items - The provider items to find credit billing for
   * @returns A map of itemId to credit billing config
   */
  private async findCreditBillingForItems(
    items: ProviderItemModel[],
  ): Promise<Record<string, string>> {
    if (!items?.length) {
      return {};
    }

    // Get global items once instead of calling cache multiple times
    const { items: globalItems } = await this.globalProviderCache.get();

    const globalProviderIds = new Set<string>();

    // Create a lookup map for global items to avoid O(n) search for each item
    const globalItemsMap = new Map<string, ProviderItemModel>();

    for (const globalItem of globalItems) {
      globalProviderIds.add(globalItem.providerId);
      try {
        const config = safeParseJSON(globalItem.config || '{}');
        const key = `${globalItem.providerId}:${config.modelId}`;
        globalItemsMap.set(key, globalItem);
      } catch (error) {
        this.logger.warn(
          `Failed to parse config for global item ${globalItem.itemId}: ${error?.message}`,
        );
      }
    }

    const creditBillingMap: Record<string, string> = {};

    // Process all items in a single pass
    for (const item of items) {
      // Skip items that are not from global providers
      if (!globalProviderIds.has(item.providerId)) {
        continue;
      }

      const config = safeParseJSON(item.config || '{}') ?? {};
      const modelId = (config as any).modelId;
      if (!modelId) {
        throw new Error(`Missing modelId in config for global item ${item.itemId}`);
      }
      const key = `${item.providerId}:${modelId}`;
      const sourceGlobalProviderItem = globalItemsMap.get(key);

      if (sourceGlobalProviderItem?.creditBilling) {
        creditBillingMap[item.itemId] = sourceGlobalProviderItem.creditBilling;
      } else {
        this.logger.warn(
          `No valid credit billing config found for item ${item.itemId}, billing will be skipped`,
        );
      }
    }

    return creditBillingMap;
  }

  async findProviderItemById(user: User, itemId: string) {
    const item = await this.prisma.providerItem.findUnique({
      where: { itemId, deletedAt: null },
      include: {
        provider: true,
      },
    });

    if (!item) {
      return null;
    }

    // If the provider item is not global, check if it belongs to the user
    if (item.uid && item.uid !== user.uid) {
      throw new ProviderItemNotFoundError(`provider item ${itemId} not found`);
    }

    if (item.uid) {
      // Try to inherit credit billing from global provider item
      const creditBillingMap = await this.findCreditBillingForItems([item]);
      const creditBilling = creditBillingMap[item.itemId];
      if (creditBilling) {
        item.creditBilling = creditBilling;
      }
    }

    // Decrypt API key
    return {
      ...item,
      provider: {
        ...item.provider,
        apiKey: this.encryptionService.decrypt(item.provider.apiKey),
      },
    };
  }

  private async getGlobalDefaultModelConfig() {
    const defaultModel = this.configService.get<Record<string, string>>('defaultModel');

    const defaultModelConfig: DefaultModelConfig = {};

    const { items } = await this.globalProviderCache.get();

    if (defaultModel.chat) {
      const chatItem = items.find((item) => {
        const config: LLMModelConfig = safeParseJSON(item.config);
        return item.itemId === defaultModel.chat || config.modelId === defaultModel.chat;
      });
      if (chatItem) {
        defaultModelConfig.chat = providerItemPO2DTO(chatItem);
      }
    }

    if (defaultModel.agent) {
      const agentItem = items.find((item) => {
        const config: LLMModelConfig = safeParseJSON(item.config);
        return item.itemId === defaultModel.agent || config.modelId === defaultModel.agent;
      });
      if (agentItem) {
        defaultModelConfig.agent = providerItemPO2DTO(agentItem);
      }
    }

    if (defaultModel.queryAnalysis) {
      const queryAnalysisItem = items.find((item) => {
        const config: LLMModelConfig = safeParseJSON(item.config);
        return (
          item.itemId === defaultModel.queryAnalysis ||
          config.modelId === defaultModel.queryAnalysis
        );
      });
      if (queryAnalysisItem) {
        defaultModelConfig.queryAnalysis = providerItemPO2DTO(queryAnalysisItem);
      }
    }

    if (defaultModel.titleGeneration) {
      const titleGenerationItem = items.find((item) => {
        const config: LLMModelConfig = safeParseJSON(item.config);
        return (
          item.itemId === defaultModel.titleGeneration ||
          config.modelId === defaultModel.titleGeneration
        );
      });
      if (titleGenerationItem) {
        defaultModelConfig.titleGeneration = providerItemPO2DTO(titleGenerationItem);
      }
    }

    if (defaultModel.image) {
      const imageItem = items.find((item) => {
        const config: MediaGenerationModelConfig = safeParseJSON(item.config);
        return item.itemId === defaultModel.image || config.modelId === defaultModel.image;
      });
      if (imageItem) {
        defaultModelConfig.image = providerItemPO2DTO(imageItem);
      }
    }

    if (defaultModel.video) {
      const videoItem = items.find((item) => {
        const config: MediaGenerationModelConfig = safeParseJSON(item.config);
        return item.itemId === defaultModel.video || config.modelId === defaultModel.video;
      });
      if (videoItem) {
        defaultModelConfig.video = providerItemPO2DTO(videoItem);
      }
    }

    if (defaultModel.audio) {
      const audioItem = items.find((item) => {
        const config: MediaGenerationModelConfig = safeParseJSON(item.config);
        return item.itemId === defaultModel.audio || config.modelId === defaultModel.audio;
      });
      if (audioItem) {
        defaultModelConfig.audio = providerItemPO2DTO(audioItem);
      }
    }

    return defaultModelConfig;
  }

  async findProviderItemsByCategory(user: User, category: ProviderCategory) {
    const { items: globalItems } = await this.globalProviderCache.get();
    const globalItemsByCategory = globalItems.filter((item) => item.category === category);

    const userPreferences = await this.getUserPreferences(user);

    // If user is using global provider mode, return global provider items
    if (userPreferences.providerMode === 'global') {
      return globalItemsByCategory;
    }

    // In custom provider mode, find user configured provider items
    const items = await this.prisma.providerItem.findMany({
      where: { uid: user.uid, category, deletedAt: null },
      include: {
        provider: true,
      },
    });

    if (items.length > 0) {
      // Try to inherit credit billing from global provider items using batch lookup
      const creditBillingMap = await this.findCreditBillingForItems(items);

      // Decrypt API key and return
      return items.map((item) => ({
        ...item,
        creditBilling: creditBillingMap[item.itemId],
        provider: {
          ...item.provider,
          apiKey: this.encryptionService.decrypt(item.provider.apiKey),
        },
      }));
    }

    // Fallback to global provider items if no user configured provider items found
    return globalItemsByCategory;
  }

  async findLLMProviderItemByModelID(user: User, modelId: string) {
    if (!modelId) {
      return null;
    }

    const items = await this.findProviderItemsByCategory(user, 'llm');

    for (const item of items) {
      try {
        const config: LLMModelConfig = safeParseJSON(item.config);
        if (config.modelId === modelId) {
          return item;
        }
      } catch (error) {
        this.logger.warn(`Failed to parse config for item ${item.itemId}: ${error?.message}`);
      }
    }

    return null;
  }

  async findMediaProviderItemByModelID(user: User, modelId: string) {
    if (!modelId) {
      return null;
    }

    const items = await this.findProviderItemsByCategory(user, 'mediaGeneration');

    for (const item of items) {
      try {
        const config: LLMModelConfig = safeParseJSON(item.config);
        if (config.modelId === modelId) {
          return item;
        }
      } catch (error) {
        this.logger.warn(`Failed to parse config for item ${item.itemId}: ${error?.message}`);
      }
    }

    return null;
  }

  async prepareChatModel(user: User, itemId: string): Promise<BaseChatModel> {
    const item = await this.findProviderItemById(user, itemId);
    if (!item) {
      throw new ChatModelNotConfiguredError();
    }

    const { provider, config } = item;
    const chatConfig: LLMModelConfig = safeParseJSON(config);

    // Pass user context for monitoring
    return getChatModel(provider, chatConfig, undefined, { userId: user.uid });
  }

  /**
   * Prepare embeddings to use according to provider configuration
   * @param user The user to prepare embeddings for
   * @returns The embeddings
   */
  async prepareEmbeddings(user: User): Promise<Embeddings> {
    const providerItems = await this.findProviderItemsByCategory(user, 'embedding');
    if (!providerItems?.length) {
      throw new EmbeddingNotConfiguredError();
    }

    const providerItem = providerItems[0];
    const { provider, config } = providerItem;
    const embeddingConfig: EmbeddingModelConfig = safeParseJSON(config);

    // Pass user context for monitoring
    return getEmbeddings(provider, embeddingConfig, { userId: user.uid });
  }

  /**
   * Prepare reranker to use according to provider configuration
   * @param user The user to prepare reranker for
   * @returns The reranker
   */
  async prepareReranker(user: User) {
    const providerItems = await this.findProviderItemsByCategory(user, 'reranker');

    // Rerankers are optional, so return null if no provider item is found
    if (!providerItems?.length) {
      return new FallbackReranker();
    }

    const providerItem = providerItems[0];
    const { provider, config } = providerItem;
    const rerankerConfig: RerankerModelConfig = safeParseJSON(config);

    return getReranker(provider, rerankerConfig);
  }

  /**
   * Prepare the model provider map for the skill invocation
   * @param user The user to prepare the model provider map for
   * @param modelItemId The modelItemId passed in the skill invocation params
   * @returns The model provider map
   */
  async prepareModelProviderMap(
    user: User,
    modelItemId: string,
  ): Promise<Record<ModelScene, ProviderItemModel>> {
    const userPo = await this.prisma.user.findUnique({
      where: { uid: user.uid },
      select: {
        preferences: true,
      },
    });
    const defaultChatItem = await this.findDefaultProviderItem(user, 'chat', userPo);
    let chatItem = modelItemId
      ? await this.findProviderItemById(user, modelItemId)
      : defaultChatItem;

    if (!chatItem) {
      throw new ProviderItemNotFoundError('chat model not configured');
    }

    if (chatItem.category !== 'llm' || !chatItem.enabled) {
      throw new ProviderItemNotFoundError(`provider item ${modelItemId} not valid`);
    }

    // Auto model routing
    const llmItems = await this.findProviderItemsByCategory(user, 'llm');
    chatItem = new AutoModelRouter({ llmItems, userId: user.uid }).route(chatItem);

    const agentItem = await this.findDefaultProviderItem(user, 'agent', userPo);
    const titleGenerationItem = await this.findDefaultProviderItem(user, 'titleGeneration', userPo);
    const queryAnalysisItem = await this.findDefaultProviderItem(user, 'queryAnalysis', userPo);
    const imageItem = await this.findDefaultProviderItem(user, 'image', userPo);
    const videoItem = await this.findDefaultProviderItem(user, 'video', userPo);
    const audioItem = await this.findDefaultProviderItem(user, 'audio', userPo);

    const modelConfigMap: Record<ModelScene, ProviderItemModel> = {
      chat: chatItem,
      agent: agentItem,
      titleGeneration: titleGenerationItem,
      queryAnalysis: queryAnalysisItem,
      image: imageItem,
      video: videoItem,
      audio: audioItem,
    };

    return modelConfigMap;
  }

  async findDefaultProviderItem(
    user: User,
    scene: ModelScene,
    userPo?: { preferences: string },
  ): Promise<ProviderItemModel | null> {
    const userPreferences = await this.getUserPreferences(user, userPo?.preferences);
    const { defaultModel: userDefaultModel } = userPreferences;

    let itemId: string | null = null;

    // First, try to get from user preferences
    if (scene === 'chat' && userDefaultModel?.chat) {
      itemId = userDefaultModel.chat.itemId;
    }
    if (scene === 'titleGeneration' && userDefaultModel?.titleGeneration) {
      itemId = userDefaultModel.titleGeneration.itemId || userDefaultModel.chat?.itemId;
    }
    if (scene === 'queryAnalysis' && userDefaultModel?.queryAnalysis) {
      itemId = userDefaultModel.queryAnalysis.itemId || userDefaultModel.chat?.itemId;
    }
    if (scene === 'agent' && userDefaultModel?.agent) {
      itemId = userDefaultModel.agent.itemId;
    }
    if (scene === 'image' && userDefaultModel?.image) {
      itemId = userDefaultModel.image.itemId;
    }
    if (scene === 'video' && userDefaultModel?.video) {
      itemId = userDefaultModel.video.itemId;
    }
    if (scene === 'audio' && userDefaultModel?.audio) {
      itemId = userDefaultModel.audio.itemId;
    }

    // If found in user preferences, try to use it
    if (itemId) {
      const providerItem = await this.prisma.providerItem.findUnique({
        where: { itemId, enabled: true, deletedAt: null },
      });
      if (providerItem && (providerItem.uid === user.uid || !providerItem.uid)) {
        return providerItem;
      }
    }

    // Fallback to global default model configuration
    const globalDefaultModel = this.configService.get('defaultModel');
    let globalModelId: string | null = null;

    if (scene === 'chat' && globalDefaultModel?.chat) {
      globalModelId = globalDefaultModel.chat;
    }
    if (scene === 'titleGeneration' && globalDefaultModel?.titleGeneration) {
      globalModelId = globalDefaultModel.titleGeneration || globalDefaultModel.chat;
    }
    if (scene === 'queryAnalysis' && globalDefaultModel?.queryAnalysis) {
      globalModelId = globalDefaultModel.queryAnalysis || globalDefaultModel.chat;
    }
    if (scene === 'agent' && globalDefaultModel?.agent) {
      globalModelId = globalDefaultModel.agent;
    }
    if (scene === 'image' && globalDefaultModel?.image) {
      globalModelId = globalDefaultModel.image || globalDefaultModel.image;
    }
    if (scene === 'video' && globalDefaultModel?.video) {
      globalModelId = globalDefaultModel.video || globalDefaultModel.video;
    }
    if (scene === 'audio' && globalDefaultModel?.audio) {
      globalModelId = globalDefaultModel.audio || globalDefaultModel.chat;
    }

    // Try to find provider item with the global model ID
    if (globalModelId) {
      const category = ['image', 'video', 'audio'].includes(scene) ? 'mediaGeneration' : 'llm';
      const availableItems = await this.findProviderItemsByCategory(user, category);
      const globalModelItem = availableItems.find((item) => {
        if (category === 'mediaGeneration') {
          const config: MediaGenerationModelConfig = safeParseJSON(item.config);
          return item.itemId === globalModelId || config.modelId === globalModelId;
        } else {
          const config: LLMModelConfig = safeParseJSON(item.config);
          return item.itemId === globalModelId || config.modelId === globalModelId;
        }
      });

      if (globalModelItem) {
        this.logger.log(
          `Using global default model ${globalModelId} for scene ${scene} for user ${user.uid}`,
        );
        return globalModelItem;
      } else {
        this.logger.warn(
          `Global default model ${globalModelId} for scene ${scene} not found in user's available models`,
        );
      }
    }

    // Final fallback to the first available item
    this.logger.log(
      `Default provider item for scene ${scene} not found in user preferences or global config, fallback to the first available model`,
    );
    const category = ['image', 'video', 'audio'].includes(scene) ? 'mediaGeneration' : 'llm';
    const availableItems = await this.findProviderItemsByCategory(user, category);
    if (availableItems.length > 0) {
      return availableItems[0];
    }

    return null;
  }

  async findProviderByCategory(user: User, category: ProviderCategory) {
    const userPreferences = await this.getUserPreferences(user);

    let providerId: string | null = null;
    if (category === 'webSearch' && userPreferences.webSearch) {
      providerId = userPreferences.webSearch?.providerId;
    } else if (category === 'urlParsing' && userPreferences.urlParsing) {
      providerId = userPreferences.urlParsing?.providerId;
    } else if (category === 'pdfParsing' && userPreferences.pdfParsing) {
      providerId = userPreferences.pdfParsing?.providerId;
    }

    if (providerId) {
      const provider = await this.prisma.provider.findUnique({
        where: {
          providerId,
          OR: [{ uid: user.uid }, { isGlobal: true }],
          deletedAt: null,
        },
      });
      if (provider?.enabled) {
        // Decrypt API key and return
        return {
          ...provider,
          apiKey: this.encryptionService.decrypt(provider.apiKey),
        };
      }
      this.logger.warn(`Provider ${providerId} not valid, fallback to search for global provider`);
    }

    const { providers: globalProviders } = await this.globalProviderCache.get();
    const globalProvider = globalProviders.find((provider) =>
      provider.categories.includes(category),
    );
    if (globalProvider) {
      return globalProvider; // Already decrypted by the global provider cache
    }

    this.logger.warn(`No valid provider found for category ${category}`);
    return null;
  }

  async createProviderItemFromGlobal(
    user: User,
    param: UpsertProviderItemRequest,
    item: ProviderItemModel,
  ) {
    return this.prisma.providerItem.create({
      data: {
        itemId: genProviderItemID(),
        category: item.category,
        name: param.name ?? item.name,
        providerId: item.providerId,
        enabled: param.enabled ?? item.enabled,
        order: param.order,
        groupName: param.group,
        uid: user.uid,
        tier: item.tier,
        config: item.config,
        creditBilling: item.creditBilling,
        globalItemId: item.itemId,
      },
    });
  }

  async createProviderItem(user: User, param: UpsertProviderItemRequest) {
    const { providerId, name, category, enabled, config, order, group, globalItemId } = param;

    // Create from global provider item
    if (globalItemId) {
      const { items: globalItems } = await this.globalProviderCache.get();
      const globalItem = globalItems.find((item) => item.itemId === globalItemId);
      if (!globalItem || !globalItem.enabled) {
        throw new ParamsError('Invalid global provider item ID');
      }

      return this.createProviderItemFromGlobal(user, param, globalItem);
    }

    if (!providerId || !category || !name) {
      throw new ParamsError('Invalid model item parameters');
    }

    const provider = await this.prisma.provider.findUnique({
      where: {
        providerId,
        deletedAt: null,
        OR: [{ uid: user.uid }, { isGlobal: true }],
      },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }

    if (provider.isGlobal) {
      throw new ParamsError('Global models can only be added via globalItemId');
    }

    const itemId = genProviderItemID();

    return this.prisma.providerItem.create({
      data: {
        itemId,
        category,
        name,
        providerId,
        enabled,
        order,
        groupName: group,
        uid: user.uid,
        config: JSON.stringify(config),
      },
    });
  }

  async batchCreateProviderItems(user: User, param: BatchUpsertProviderItemsRequest) {
    const { items } = param;

    if (!items || items.length === 0) {
      throw new ParamsError('Items are required');
    }

    if (items.length > PROVIDER_ITEMS_BATCH_LIMIT) {
      throw new ParamsError('Too many items to create');
    }

    const providerIds = new Set<string>();

    for (const item of items) {
      if (!item.providerId || !item.category || !item.name) {
        throw new ParamsError('Invalid model item parameters');
      }
      providerIds.add(item.providerId);
    }

    const providerCnt = await this.prisma.provider.count({
      where: {
        providerId: { in: Array.from(providerIds) },
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });
    if (providerCnt !== providerIds.size) {
      throw new ParamsError('Invalid provider IDs');
    }

    return this.prisma.providerItem.createManyAndReturn({
      data: items.map((item) => ({
        itemId: genProviderItemID(),
        category: item.category,
        name: item.name,
        providerId: item.providerId,
        enabled: item.enabled,
        order: item.order,
        group: item.group,
        uid: user.uid,
        config: JSON.stringify(item.config),
      })),
    });
  }

  async updateProviderItem(user: User, param: UpsertProviderItemRequest) {
    const { itemId, name, enabled, config, providerId, order, group } = param;

    if (!itemId) {
      throw new ParamsError('Item ID is required');
    }

    const item = await this.prisma.providerItem.findUnique({
      where: {
        itemId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ProviderItemNotFoundError();
    }

    if (item.category === 'embedding') {
      if (!(await this.vectorSearchService.isCollectionEmpty())) {
        throw new EmbeddingNotAllowedToChangeError();
      }
    }

    return this.prisma.providerItem.update({
      where: {
        pk: item.pk,
      },
      data: {
        name,
        enabled,
        providerId,
        order,
        groupName: group,
        ...(config ? { config: JSON.stringify(config) } : {}),
      },
    });
  }

  async batchUpdateProviderItems(user: User, param: BatchUpsertProviderItemsRequest) {
    const { items } = param;

    if (!items || items.length === 0) {
      throw new ParamsError('Items are required');
    }

    if (items.length > PROVIDER_ITEMS_BATCH_LIMIT) {
      throw new ParamsError('Too many items to update');
    }

    // Validate all items have an itemId
    for (const item of items) {
      if (!item.itemId) {
        throw new ParamsError('Item ID is required for all items');
      }
    }

    // Find all items to update
    const itemIds = items.map((item) => item.itemId);
    const existingItems = await this.prisma.providerItem.findMany({
      where: {
        itemId: { in: itemIds },
        uid: user.uid,
        deletedAt: null,
      },
    });

    // Verify all requested items exist
    if (existingItems.length !== itemIds.length) {
      throw new ProviderItemNotFoundError('One or more items not found');
    }

    // Create a map of existing items for easy lookup
    const itemMap = new Map();
    for (const item of existingItems) {
      itemMap.set(item.itemId, item);
    }

    // Process updates in parallel
    const limit = pLimit(10);
    const updatePromises = items.map((item) =>
      limit(() => {
        const existingItem = itemMap.get(item.itemId);

        return this.prisma.providerItem.update({
          where: {
            pk: existingItem.pk,
          },
          data: {
            name: item.name,
            enabled: item.enabled,
            providerId: item.providerId,
            order: item.order,
            groupName: item.group,
            ...(item.config ? { config: JSON.stringify(item.config) } : {}),
          },
        });
      }),
    );

    return Promise.all(updatePromises);
  }

  async deleteProviderItem(user: User, param: DeleteProviderItemRequest) {
    const { itemId } = param;

    if (!itemId) {
      throw new ParamsError('Item ID is required');
    }

    const item = await this.prisma.providerItem.findUnique({
      where: {
        itemId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new ProviderItemNotFoundError();
    }

    return this.prisma.providerItem.update({
      where: {
        pk: item.pk,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async listProviderItemOptions(
    user: User,
    param: ListProviderItemOptionsData['query'],
  ): Promise<ProviderItemOption[]> {
    const { providerId, category } = param;

    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.provider.findUnique({
      where: {
        providerId,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }

    if (provider.isGlobal) {
      const { items: globalItems } = await this.globalProviderCache.get();
      return globalItems
        .filter(
          (item) => item.providerId === providerId && (!category || item.category === category),
        )
        .map((item) => ({
          name: item.name,
          category: item.category as ProviderCategory,
          tier: item.tier as ModelTier,
          config: safeParseJSON(item.config || '{}'),
        }));
    }

    const apiKey = provider.apiKey ? this.encryptionService.decrypt(provider.apiKey) : null;

    try {
      const res = await fetch(`${provider.baseUrl}/models`, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      const data = await res.json();

      return (
        data?.data?.map(
          (model) =>
            ({
              name: model.name || model.id,
              category,
              config: { modelId: model.id, modelName: model.name || model.id },
            }) as ProviderItemOption,
        ) ?? []
      );
    } catch (error) {
      this.logger.warn(
        `Failed to list provider item options for provider ${providerId}: ${error.stack}`,
      );
      return [];
    }
  }

  /**
   * Test provider connection and API availability
   * @param user The user to test provider for
   * @param param Test connection parameters
   * @returns Test result with status and details
   */
  async testProviderConnection(
    user: User,
    param: { providerId: string; category?: ProviderCategory },
  ): Promise<ProviderCheckResult> {
    const { providerId, category } = param;

    // Confirm method is being called
    if (!providerId) {
      throw new ParamsError('Provider ID is required');
    }

    const provider = await this.prisma.provider.findUnique({
      where: { providerId, deletedAt: null, OR: [{ uid: user.uid }, { isGlobal: true }] },
    });

    if (!provider) {
      throw new ProviderNotFoundError();
    }

    // Identify the test scenario
    const isTemporaryProvider = provider.name.startsWith('temp_test_');
    const _testScenario = provider.isGlobal
      ? 'Global Provider Test'
      : isTemporaryProvider
        ? 'New Config Test (Temporary Provider)' // Case 2&3: New or modify config test
        : 'Existing Provider Test'; // Case 1: Edit mode directly test

    try {
      // Check if encrypted API key exists in database
      const apiKey = provider.apiKey ? this.encryptionService.decrypt(provider.apiKey) : null;

      // Create provider check configuration
      const checkConfig = {
        providerId,
        providerKey: provider.providerKey,
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiKey,
        categories: provider.categories.split(','),
      };

      // Use ProviderChecker from packages/providers
      const providerChecker = new ProviderChecker();
      const result = await providerChecker.checkProvider(checkConfig, category);

      return result;
    } catch (error) {
      // Re-throw the error to let the global error handler deal with it
      // or create a proper error response using ProviderChecker's error format
      const errorResult: ProviderCheckResult = {
        providerId,
        providerKey: provider.providerKey,
        name: provider.name,
        baseUrl: provider.baseUrl,
        categories: provider.categories.split(','),
        status: 'failed',
        message: error?.message || 'Connection check failed',
        details: {
          error: {
            status: 'failed',
            error: {
              type: error?.constructor?.name || 'Error',
              message: error?.message,
              ...(error?.response ? { response: error.response } : {}),
            },
          },
        },
        timestamp: new Date().toISOString(),
      };

      return errorResult;
    }
  }
}
