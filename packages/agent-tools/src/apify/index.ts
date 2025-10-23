import { z } from 'zod/v3';
import { ApifyClient, ActorStoreList, Actor, Build } from 'apify-client';

// Types for actor pricing and search results
type ActorPricingModel = 'FREE' | 'PAY_PER_EVENT' | 'FLAT_PRICE_PER_MONTH';

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
import type { ToolsetDefinition } from '@refly/openapi-schema';

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
        en: 'Search the Apify Store for Actors using keywords. Use this tool FIRST to find relevant Actors and obtain their names (format: username/actor-name, e.g., apify/rag-web-browser). Extract the actor names from URLs like https://apify.com/clockworks/tiktok-scraper to get "clockworks/tiktok-scraper".',
        'zh-CN':
          '使用关键词搜索 Apify Store 中的 Actors。这是工作流的第一步，用于查找相关 Actors 并获取它们的名称（格式：username/actor-name，例如：apify/rag-web-browser）。从类似 https://apify.com/clockworks/tiktok-scraper 的 URL 中提取 actor 名称，得到 "clockworks/tiktok-scraper"。',
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

interface ApifyToolParams extends ToolParams {
  apiToken: string;
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
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      return {
        status: 'success',
        data: {
          run,
          items,
          datasetUrl: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
        },
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
        'A string to search for in the Actor\'s title, name, description, username, and readme. Use simple space-separated keywords, such as "web scraping", "data extraction", or "playwright browser". Do not use complex queries, AND/OR operators, or other advanced syntax, as this tool uses full-text search only.',
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

  description = `Search the Apify Store for Actors using keywords. Use this tool FIRST to find relevant Actors and obtain their names (format: username/actor-name, e.g., apify/rag-web-browser). Extract the actor names from URLs like https://apify.com/clockworks/tiktok-scraper to get "clockworks/tiktok-scraper".

Apify Store features solutions for web scraping, automation, and AI agents (e.g., Instagram, TikTok, LinkedIn, flights, bookings).

The results will include curated Actor cards with title, description, pricing model, usage statistics, and ratings.
For best results, use simple space-separated keywords (e.g., "instagram posts", "twitter profile", "playwright mcp").
After finding actors, use fetchActorDetails to get the Input Schema before running any Actor.

WORKFLOW:
1. Use searchActors to find relevant Actors and extract their names
2. Use fetchActorDetails with the actor name to get Input Schema
3. Use runActor with the proper input parameters from the schema

USAGE EXAMPLES:
- user_input: Find Actors for scraping e-commerce
- user_input: Find browserbase MCP server
- user_input: I need to scrape instagram profiles and comments
- user_input: I need to get flights and airbnb data`;

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

// Helper functions for searching actors
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
