import { z } from 'zod/v3';
import { ApifyClient, ActorStoreList, Actor, Build, ActorRun } from 'apify-client';

// Types for actor pricing and search results
type ActorPricingModel = 'FREE' | 'PAY_PER_EVENT' | 'FLAT_PRICE_PER_MONTH';

/**
 * Calculate credit cost based on Apify Actor pricing
 * 1 USD = 140 credits, round up to minimum 1 credit
 */
function calculateCreditCost(run: ActorRun, itemsLength?: number): number {
  // Priority 1: Use usageTotalUsd if available
  if (run.usageTotalUsd !== undefined) {
    const costInCredits = run.usageTotalUsd * 140;
    return Math.max(1, Math.ceil(costInCredits));
  }

  // Priority 2: Calculate based on pricing model
  if (!run.pricingInfo) {
    return 0; // No pricing info means free
  }

  const pricingInfo = run.pricingInfo;
  let totalCostUsd = 0;

  switch (pricingInfo.pricingModel) {
    case 'FREE':
      totalCostUsd = 0;
      break;

    case 'PRICE_PER_DATASET_ITEM':
      if (itemsLength !== undefined) {
        totalCostUsd = itemsLength * pricingInfo.pricePerUnitUsd;
      }
      break;

    case 'PAY_PER_EVENT':
      if (run.chargedEventCounts) {
        const { pricingPerEvent } = pricingInfo;
        totalCostUsd = Object.entries(run.chargedEventCounts).reduce((total, [eventKey, count]) => {
          const eventPrice = pricingPerEvent.actorChargeEvents[eventKey]?.eventPriceUsd || 0;
          return total + eventPrice * count;
        }, 0);
      }
      break;

    case 'FLAT_PRICE_PER_MONTH':
      // Monthly pricing - for single runs, we might need to prorate, but for now use the full price
      totalCostUsd = pricingInfo.pricePerUnitUsd ?? (itemsLength ?? 0) * 0.002;
      break;

    default:
      totalCostUsd = 0;
  }

  // Apply minimum charge if specified
  if (
    pricingInfo.pricingModel === 'PAY_PER_EVENT' &&
    pricingInfo.minimalMaxTotalChargeUsd !== undefined
  ) {
    totalCostUsd = Math.max(totalCostUsd, pricingInfo.minimalMaxTotalChargeUsd);
  }

  // Convert to credits: 1 USD = 140 credits, minimum 1 credit
  const costInCredits = totalCostUsd * 140;
  return Math.max(1, Math.ceil(costInCredits));
}

interface ExtendedActorStoreList extends ActorStoreList {
  // Extended properties if needed
}

// Interface for Actor details result
interface ActorDetailsResult {
  actorInfo: Actor;
  buildInfo: Build;
  actorCard: string;
  inputSchema: Record<string, any>;
  readme: string;
}
import type { ToolParams } from '@langchain/core/tools';
import {
  AgentBaseTool,
  AgentBaseToolset,
  type AgentToolConstructor,
  type ToolCallResult,
} from '../base';
import type {
  ToolsetDefinition,
  User,
  EntityType,
  FileVisibility,
  UploadResponse,
} from '@refly/openapi-schema';

// Toolset definition
export const ApifyToolsetDefinition: ToolsetDefinition = {
  key: 'apify',
  domain: 'https://apify.com',
  labelDict: {
    en: 'Apify',
    'zh-CN': 'Apify',
  },
  descriptionDict: {
    en: 'Run Apify Actors for web automation and data extraction',
    'zh-CN': '运行 Apify Actors 进行网络自动化和数据提取',
  },
  tools: [
    {
      name: 'runActor',
      descriptionDict: {
        en: 'Run an Apify Actor with input data. Use this tool LAST in the workflow - only after you have obtained the Input Schema from fetchActorDetails tool. Provide the exact input parameters that match the schema retrieved.',
        'zh-CN':
          '使用输入数据运行 Apify Actor。这是工作流的最后一步 - 只有在从 fetchActorDetails 工具获取输入模式后才能使用。请提供与获取的模式完全匹配的输入参数。',
      },
    },
    {
      name: 'searchActors',
      descriptionDict: {
        en: 'Search Apify Store for Actors by data source/platform name. Use ONLY the target data source name (e.g., "instagram", "booking") - keep it brief and generic. Use this tool FIRST to find Actors, then use fetchActorDetails to get input schema.',
        'zh-CN':
          '按数据源/平台名称搜索 Apify Store 中的 Actors。只使用目标数据源名称（例如："instagram"、"booking"）- 保持简洁通用。这是第一步找到 Actors，然后使用 fetchActorDetails 获取输入模式。',
      },
    },
    {
      name: 'fetchActorDetails',
      descriptionDict: {
        en: 'Get detailed information about an Apify Actor, especially the Input Schema. Use this tool SECOND in the workflow - after finding actor names with searchActors. This will provide the exact input parameters and their types that you need for running the Actor.',
        'zh-CN':
          '获取 Apify Actor 的详细信息，特别是输入模式（Input Schema）。这是工作流的第二步 - 在使用 searchActors 找到 actor 名称后使用。这将提供运行 Actor 所需的准确输入参数及其类型。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiToken',
          inputMode: 'text',
          inputProps: { passwordType: true },
          labelDict: { en: 'API Token', 'zh-CN': 'API 令牌' },
          descriptionDict: { en: 'Apify API token', 'zh-CN': 'Apify 的 API 令牌' },
          required: true,
        },
      ],
    },
  ],
  configItems: [],
};

export interface ReflyService {
  uploadFile: (
    user: User,
    param: {
      file: { buffer: Buffer; mimetype?: string; originalname: string };
      entityId?: string;
      entityType?: EntityType;
      visibility?: FileVisibility;
      storageKey?: string;
    },
  ) => Promise<UploadResponse['data']>;
}
interface ApifyToolParams extends ToolParams {
  apiToken: string;
  user: User;
  reflyService: ReflyService;
}

// runActor
export class ApifyRunActor extends AgentBaseTool<ApifyToolParams> {
  name = 'runActor';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    actorId: z.string().describe('The ID of the Apify Actor to run'),
    input: z.record(z.any()).describe('Input data for the Actor'),
  });

  description =
    'Run an Apify Actor with input data. Use this tool LAST in the workflow - only after you have obtained the Input Schema from fetchActorDetails tool. Provide the exact input parameters that match the schema retrieved.';

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new ApifyClient({
        token: this.params?.apiToken ?? '',
      });

      // Run the Actor and wait for it to finish
      const run = await client.actor(input.actorId).call(input.input);

      // Fetch and return Actor results from the run's dataset
      const v = await client.dataset(run.defaultDatasetId).listItems();

      if (!v) {
        return {
          status: 'error',
          error: 'Dataset not found',
          summary: `Dataset '${run.defaultDatasetId}' not found.`,
        };
      }

      // Convert dataset items to CSV and upload via Refly service
      const items = Array.isArray(v?.items) ? (v.items as Record<string, any>[]) : [];

      // Helper to convert items to CSV string
      const toCsv = (rows: Record<string, any>[]): string => {
        if (!Array.isArray(rows) || rows.length === 0) {
          return '';
        }

        const headers: string[] = [];
        for (const row of rows) {
          const keys = Object.keys(row ?? {});
          for (const key of keys) {
            if (!headers.includes(key)) headers.push(key);
          }
        }

        const escapeValue = (value: unknown): string => {
          if (value == null) return '';
          const normalized =
            typeof value === 'object' ? (JSON.stringify(value) ?? '') : String(value ?? '');
          const escaped = normalized.replace(/"/g, '""');
          const needsQuotes = /[",\n\r]/.test(escaped);
          return needsQuotes ? `"${escaped}"` : escaped;
        };

        const lines: string[] = [];
        lines.push(headers.join(','));
        for (const row of rows) {
          const values = headers.map((h) => escapeValue((row as Record<string, any>)?.[h]));
          lines.push(values.join(','));
        }
        return lines.join('\n');
      };

      let storageKey: string | undefined;
      try {
        const csv = toCsv(items);
        const buffer = Buffer.from(csv ?? '', 'utf8');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const originalname = `${run.defaultDatasetId}-${ts}.csv`;
        const uploadRes = await this.params?.reflyService?.uploadFile?.(this.params?.user, {
          file: { buffer, mimetype: 'text/csv', originalname },
        });
        storageKey = uploadRes?.storageKey ?? undefined;
      } catch {
        // Ignore upload errors; continue returning the dataset items
        storageKey = undefined;
      }

      // Calculate credit cost
      const creditCost = calculateCreditCost(run, items.length);

      return {
        status: 'success',
        data: {
          run,
          storageKey,
        },
        creditCost,
        summary: `Successfully ran Actor "${input.actorId}" and retrieved ${items.length} results`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error running Actor',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while running Actor',
      };
    }
  }
}

// searchActors
export class ApifySearchActors extends AgentBaseTool<ApifyToolParams> {
  name = 'searchActors';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    search: z
      .string()
      .default('')
      .describe(
        'Data source keywords to search for Apify Actors. Use ONLY the target data source/platform names (e.g., "instagram", "tiktok", "linkedin", "airbnb", "booking"). Keep it extremely brief - just the data source name. DO NOT include specific search parameters or queries - those go in the input schema when running the Actor.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('The maximum number of Actors to return. The default value is 10.'),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('The number of elements to skip at the start. The default value is 0.'),
  });

  description = `Search Apify Store for Actors by data source/platform. Use this tool FIRST in the workflow.

IMPORTANT: Search parameter should ONLY contain the data source name (e.g., "instagram", "tiktok", "booking"). Keep it extremely brief and generic - do NOT include specific search terms, URLs, or queries.

WORKFLOW (3 steps):
1. Use searchActors with ONLY data source name to find relevant Actors
2. Use fetchActorDetails to get the Actor's input schema and requirements
3. Use runActor with proper input parameters from the schema

The search parameter is for finding data source Actors only. Specific search parameters (URLs, keywords, dates, etc.) are provided later when running the Actor.

EXAMPLES:
- For Instagram data: search="instagram"
- For flight bookings: search="booking" or search="amadeus"
- For LinkedIn profiles: search="linkedin"
- For TikTok videos: search="tiktok"

After finding Actors, always use fetchActorDetails next to understand the input requirements.`;

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const ACTOR_SEARCH_ABOVE_LIMIT = 10; // Fetch extra actors to account for filtering

      let actors = await searchActorsByKeywords(
        input.search,
        this.params?.apiToken ?? '',
        input.limit + ACTOR_SEARCH_ABOVE_LIMIT,
        input.offset,
      );

      // Filter out rental actors (FLAT_PRICE_PER_MONTH) that user hasn't rented
      actors = filterRentalActors(actors || [], []).slice(0, input.limit);

      const actorCards = actors.length === 0 ? [] : actors.map(formatActorToCard);

      const actorsText = actorCards.length
        ? actorCards.join('\n\n')
        : 'No Actors were found for the given search query. Please try different keywords or simplify your query.';

      return {
        status: 'success',
        data: {
          searchQuery: input.search,
          totalFound: actorCards.length,
          actors: actors,
          formattedResults: actorsText,
        },
        summary: `Found ${actorCards.length} Actors for search query "${input.search}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching Actors',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while searching Actors',
      };
    }
  }
}

// fetchActorDetails
export class ApifyFetchActorDetails extends AgentBaseTool<ApifyToolParams> {
  name = 'fetchActorDetails';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    actor: z
      .string()
      .min(1)
      .describe(
        'Actor ID or full name in the format "username/name", e.g., "apify/rag-web-browser".',
      ),
  });

  description = `Get detailed information about an Apify Actor, especially the Input Schema. Use this tool SECOND in the workflow - after finding actor names with searchActors. This will provide the exact input parameters and their types that you need for running the Actor.

This returns the Actor's title, description, URL, README (documentation), input schema, pricing/usage information, and basic stats.
Present the information in a user-friendly Actor card with the Input Schema clearly highlighted.

WORKFLOW:
1. Use searchActors to find relevant Actors and extract their names
2. Use fetchActorDetails with the actor name to get Input Schema ← YOU ARE HERE
3. Use runActor with the proper input parameters from the schema

USAGE:
- Use when you have an actor name and need to know its Input Schema for running it.
- Focus on extracting the input parameters and their types from the schema.

USAGE EXAMPLES:
- user_input: How to use apify/rag-web-browser
- user_input: What is the input schema for apify/rag-web-browser?
- user_input: What is the pricing for apify/instagram-scraper?`;

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const apifyClient = new ApifyClient({
        token: this.params?.apiToken ?? '',
      });

      const details = await fetchActorDetails(apifyClient, input.actor);

      if (!details) {
        return {
          status: 'error',
          error: 'Actor not found',
          summary: `Actor information for '${input.actor}' was not found. Please check the Actor ID or name and ensure the Actor exists.`,
        };
      }

      const actorUrl = `https://apify.com/${details.actorInfo.username}/${details.actorInfo.name}`;
      // Add link to README title
      const readmeWithLink = details.readme.replace(/^# /, `# [README](${actorUrl}/readme): `);

      const content = [
        { type: 'text', text: `# Actor information\n${details.actorCard}` },
        { type: 'text', text: `${readmeWithLink}` },
      ];

      // Include input schema if it has properties
      if (
        details.inputSchema.properties &&
        Object.keys(details.inputSchema.properties).length > 0
      ) {
        content.push({
          type: 'text',
          text: `# [Input schema](${actorUrl}/input)\n\`\`\`json\n${JSON.stringify(details.inputSchema, null, 2)}\n\`\`\``,
        });
      }

      return {
        status: 'success',
        data: {
          actorInfo: details.actorInfo,
          readme: details.readme,
          inputSchema: details.inputSchema,
          actorUrl,
        },
        summary: `Successfully retrieved details for Actor "${input.actor}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error fetching Actor details',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while fetching Actor details',
      };
    }
  }
}

// getDatasetItems
export class ApifyGetDatasetItems extends AgentBaseTool<ApifyToolParams> {
  name = 'getDatasetItems';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    datasetId: z.string().min(1).describe('Dataset ID or username~dataset-name.'),
    clean: z
      .boolean()
      .optional()
      .describe(
        'If true, returns only non-empty items and skips hidden fields (starting with #). Shortcut for skipHidden=true and skipEmpty=true.',
      ),
    offset: z.number().optional().describe('Number of items to skip at the start. Default is 0.'),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of items to return. No limit by default.'),
    fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated list of fields to include in results. ' +
          'Fields in output are sorted as specified. ' +
          'For nested objects, use dot notation (e.g. "metadata.url") after flattening.',
      ),
    omit: z.string().optional().describe('Comma-separated list of fields to exclude from results.'),
    desc: z
      .boolean()
      .optional()
      .describe('If true, results are returned in reverse order (newest to oldest).'),
    flatten: z
      .string()
      .optional()
      .describe(
        'Comma-separated list of fields which should transform nested objects into flat structures. ' +
          'For example, with flatten="metadata" the object {"metadata":{"url":"hello"}} becomes {"metadata.url":"hello"}. ' +
          'This is required before accessing nested fields with the fields parameter.',
      ),
  });

  description = `Retrieve dataset items with pagination, sorting, and field selection.
Use clean=true to skip empty items and hidden fields. Include or omit fields using comma-separated lists.
For nested objects, first flatten them (e.g., flatten="metadata"), then reference nested fields via dot notation (e.g., fields="metadata.url").

The results will include items along with pagination info (limit, offset) and total count.

USAGE:
- Use when you need to read data from a dataset (all items or only selected fields).

USAGE EXAMPLES:
- user_input: Get first 100 items from dataset abd123
- user_input: Get only metadata.url and title from dataset username~my-dataset (flatten metadata)`;

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new ApifyClient({
        token: this.params?.apiToken ?? '',
      });

      // Convert comma-separated strings to arrays
      const fields = parseCommaSeparatedList(input.fields);
      const omit = parseCommaSeparatedList(input.omit);
      const flatten = parseCommaSeparatedList(input.flatten);

      const v = await client.dataset(input.datasetId).listItems({
        clean: input.clean,
        offset: input.offset,
        limit: input.limit,
        fields,
        omit,
        desc: input.desc,
        flatten,
      });

      if (!v) {
        return {
          status: 'error',
          error: 'Dataset not found',
          summary: `Dataset '${input.datasetId}' not found.`,
        };
      }

      // Convert dataset items to CSV and upload via Refly service
      const items = Array.isArray(v?.items) ? (v.items as Record<string, any>[]) : [];

      // Helper to convert items to CSV string
      const toCsv = (rows: Record<string, any>[]): string => {
        if (!Array.isArray(rows) || rows.length === 0) {
          return '';
        }

        const headers: string[] = [];
        for (const row of rows) {
          const keys = Object.keys(row ?? {});
          for (const key of keys) {
            if (!headers.includes(key)) headers.push(key);
          }
        }

        const escapeValue = (value: unknown): string => {
          if (value == null) return '';
          const normalized =
            typeof value === 'object' ? (JSON.stringify(value) ?? '') : String(value ?? '');
          const escaped = normalized.replace(/"/g, '""');
          const needsQuotes = /[",\n\r]/.test(escaped);
          return needsQuotes ? `"${escaped}"` : escaped;
        };

        const lines: string[] = [];
        lines.push(headers.join(','));
        for (const row of rows) {
          const values = headers.map((h) => escapeValue((row as Record<string, any>)?.[h]));
          lines.push(values.join(','));
        }
        return lines.join('\n');
      };

      let storageKey: string | undefined;
      try {
        const csv = toCsv(items);
        const buffer = Buffer.from(csv ?? '', 'utf8');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const originalname = `${input?.datasetId ?? 'dataset'}-${ts}.csv`;
        const uploadRes = await this.params?.reflyService?.uploadFile?.(this.params?.user, {
          file: { buffer, mimetype: 'text/csv', originalname },
        });
        storageKey = uploadRes?.storageKey ?? undefined;
      } catch {
        // Ignore upload errors; continue returning the dataset items
        storageKey = undefined;
      }

      return {
        status: 'success',
        data: { storageKey },
        summary: `Successfully retrieved ${v.items?.length ?? 0} items from dataset "${input.datasetId}"${storageKey ? ` and uploaded CSV (storageKey: ${storageKey})` : ''}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving dataset items',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while retrieving dataset items',
      };
    }
  }
}

// Helper functions for searching actors
/**
 * Parses a comma-separated string into an array of trimmed strings.
 * Empty strings are filtered out after trimming.
 *
 * @param input - The comma-separated string to parse. If undefined, returns an empty array.
 * @returns An array of trimmed, non-empty strings.
 * @example
 * parseCommaSeparatedList("a, b, c"); // ["a", "b", "c"]
 * parseCommaSeparatedList("a, , b"); // ["a", "b"]
 */
function parseCommaSeparatedList(input?: string): string[] {
  if (!input) {
    return [];
  }
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function searchActorsByKeywords(
  search: string,
  apifyToken: string,
  limit: number | undefined = undefined,
  offset: number | undefined = undefined,
): Promise<ExtendedActorStoreList[]> {
  const client = new ApifyClient({ token: apifyToken });
  const storeClient = client.store();

  const results = await storeClient.list({ search, limit, offset });
  return results.items as ExtendedActorStoreList[];
}

/**
 * Filters out actors with the 'FLAT_PRICE_PER_MONTH' pricing model (rental actors),
 * unless the actor's ID is present in the user's rented actor IDs list.
 *
 * This is necessary because the Store list API does not support filtering by multiple pricing models at once.
 *
 * @param actors - Array of ActorStoreList objects to filter.
 * @param userRentedActorIds - Array of Actor IDs that the user has rented.
 * @returns Array of Actors excluding those with 'FLAT_PRICE_PER_MONTH' pricing model (= rental Actors),
 *  except for Actors that the user has rented (whose IDs are in userRentedActorIds).
 */
function filterRentalActors(
  actors: ActorStoreList[],
  userRentedActorIds: string[] = [],
): ActorStoreList[] {
  // Store list API does not support filtering by two pricing models at once,
  // so we filter the results manually after fetching them.
  return actors.filter(
    (actor) =>
      (actor.currentPricingInfo?.pricingModel as ActorPricingModel) !== 'FLAT_PRICE_PER_MONTH' ||
      userRentedActorIds.includes(actor.id),
  );
}

// Helper function to format actor information
function formatActorToCard(actor: ActorStoreList): string {
  const pricing = actor.currentPricingInfo;
  const pricingText = pricing ? `${pricing.pricingModel}` : 'Free';

  return `## ${actor.name}
**Title:** ${actor.title || actor.name}
**Description:** ${actor.description || 'No description available'}
**Pricing:** ${pricingText}
**Runs:** ${actor.stats?.totalRuns || 0}
**Users:** ${actor.stats?.totalUsers || 0}
**URL:** https://apify.com/${actor.username}/${actor.name}`;
}

// Helper function to format Actor details into a card
function formatActorToActorCard(actor: Actor): string {
  const pricingText =
    'pricingInfos' in actor && actor.pricingInfos?.length
      ? actor.pricingInfos[0].pricingModel
      : 'Free';

  const actorUrl = `https://apify.com/${actor.username}/${actor.name}`;

  return `## [${actor.title}](${actorUrl}) (\`${actor.username}/${actor.name}\`)
- **URL:** ${actorUrl}
- **Developed by:** [${actor.username}](https://apify.com/${actor.username}) ${actor.username === 'apify' ? '(Apify)' : '(community)'}
- **Description:** ${actor.description || 'No description provided.'}
- **Pricing:** ${pricingText}`;
}

// Simplified fetchActorDetails function
async function fetchActorDetails(
  apifyClient: ApifyClient,
  actorName: string,
): Promise<ActorDetailsResult | null> {
  try {
    const [actorInfo, buildInfo]: [Actor | undefined, Build | undefined] = await Promise.all([
      apifyClient.actor(actorName).get(),
      apifyClient
        .actor(actorName)
        .defaultBuild()
        .then(async (build) => build.get())
        .catch(() => undefined), // Handle case where build might not exist
    ]);

    if (!actorInfo || !buildInfo || !buildInfo.actorDefinition) {
      return null;
    }

    const inputSchema = (buildInfo.actorDefinition.input || {
      type: 'object',
      properties: {},
    }) as Record<string, any>;

    const actorCard = formatActorToActorCard(actorInfo);

    return {
      actorInfo,
      buildInfo,
      actorCard,
      inputSchema,
      readme: buildInfo.actorDefinition.readme || 'No README provided.',
    };
  } catch {
    return null;
  }
}

export class ApifyToolset extends AgentBaseToolset<ApifyToolParams> {
  toolsetKey = ApifyToolsetDefinition.key;
  tools = [
    ApifyRunActor,
    ApifySearchActors,
    ApifyFetchActorDetails,
  ] satisfies readonly AgentToolConstructor<ApifyToolParams>[];
}
