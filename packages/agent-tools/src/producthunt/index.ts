// import { z } from 'zod/v3';
// import { ToolParams } from '@langchain/core/tools';
// import { ProductHuntClient } from './client';
// import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
// import { ToolsetDefinition } from '@refly/openapi-schema';

// export const ProductHuntToolsetDefinition: ToolsetDefinition = {
//   key: 'producthunt',
//   domain: 'https://www.producthunt.com',
//   labelDict: {
//     en: 'Product Hunt',
//     'zh-CN': 'Product Hunt',
//   },
//   descriptionDict: {
//     en: 'Product Hunt is a platform for discovering and sharing new products. Access trending products, user posts, upvoted content, and topics through the official API.',
//     'zh-CN':
//       'Product Hunt 是一个发现和分享新产品的平台。通过官方 API 访问热门产品、用户发布的内容、点赞内容和话题。',
//   },
//   tools: [
//     {
//       name: 'list_posts',
//       descriptionDict: {
//         en: 'List posts from Product Hunt, optionally filtered by topic. Returns product information including name, tagline, votes, and creation date.',
//         'zh-CN':
//           '列出 Product Hunt 的帖子，可选择按话题过滤。返回产品信息包括名称、标语、投票数和创建日期。',
//       },
//     },
//     {
//       name: 'list_user_posts',
//       descriptionDict: {
//         en: 'List posts made by a specific user on Product Hunt. Returns the products they have launched.',
//         'zh-CN': '列出 Product Hunt 上特定用户发布的帖子。返回他们发布的产品。',
//       },
//     },
//     {
//       name: 'list_upvoted_posts',
//       descriptionDict: {
//         en: 'List posts upvoted by a specific user on Product Hunt. Returns the products they have voted for.',
//         'zh-CN': '列出 Product Hunt 上特定用户点赞的帖子。返回他们投票支持的产品。',
//       },
//     },
//     {
//       name: 'list_topics',
//       descriptionDict: {
//         en: 'List all available topics on Product Hunt. Returns topic names and slugs for filtering posts.',
//         'zh-CN': '列出 Product Hunt 上所有可用的话题。返回话题名称和 slug 用于过滤帖子。',
//       },
//     },
//   ],
//   requiresAuth: true,
//   authPatterns: [
//     {
//       type: 'credentials',
//       credentialItems: [
//         {
//           key: 'apiKey',
//           inputMode: 'text',
//           inputProps: {
//             passwordType: true,
//           },
//           labelDict: {
//             en: 'API Key',
//             'zh-CN': 'API 密钥',
//           },
//           descriptionDict: {
//             en: 'The API key for Product Hunt GraphQL API',
//             'zh-CN': 'Product Hunt GraphQL API 的 API 密钥',
//           },
//           required: true,
//         },
//       ],
//     },
//   ],
//   configItems: [
//     {
//       key: 'baseUrl',
//       inputMode: 'text',
//       labelDict: {
//         en: 'Base URL',
//         'zh-CN': '基础 URL',
//       },
//       descriptionDict: {
//         en: 'The base URL of Product Hunt GraphQL API',
//         'zh-CN': 'Product Hunt GraphQL API 的基础 URL',
//       },
//       defaultValue: 'https://api.producthunt.com/v2/api/graphql',
//     },
//   ],
// };

// interface ProductHuntToolParams extends ToolParams {
//   apiKey: string;
//   accessToken: string;
//   baseUrl?: string;
// }

// export class ProductHuntListPosts extends AgentBaseTool<ProductHuntToolParams> {
//   name = 'list_posts';
//   toolsetKey = ProductHuntToolsetDefinition.key;

//   schema = z.object({
//     topic: z.string().describe('Optional topic slug to filter posts').optional(),
//     sortBy: z
//       .enum(['NEWEST', 'POPULAR', 'FEATURED'])
//       .describe('Sort order for posts')
//       .default('NEWEST'),
//     max: z.number().describe('Maximum number of posts to return').max(100).default(20),
//   });

//   description =
//     'List posts from Product Hunt, optionally filtered by topic. Returns product information including name, tagline, votes, and creation date.';

//   protected params: ProductHuntToolParams;

//   constructor(params: ProductHuntToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new ProductHuntClient({
//         accessToken: this.params.accessToken,
//         baseUrl: this.params.baseUrl,
//       });

//       const data = await client.listPosts({
//         topic: input.topic,
//         sortBy: input.sortBy,
//         max: input.max,
//       });

//       const posts = data.posts.edges.map((edge) => edge.node);

//       return {
//         status: 'success',
//         data: {
//           posts,
//           totalCount: posts.length,
//           topic: input.topic,
//           sortBy: input.sortBy,
//         },
//         summary: `Successfully retrieved ${posts.length} posts${input.topic ? ` in topic "${input.topic}"` : ''} sorted by ${input.sortBy.toLowerCase()}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error listing posts',
//         summary:
//           error instanceof Error ? error.message : 'Unknown error occurred while listing posts',
//       };
//     }
//   }
// }

// export class ProductHuntListUserPosts extends AgentBaseTool<ProductHuntToolParams> {
//   name = 'list_user_posts';
//   toolsetKey = ProductHuntToolsetDefinition.key;

//   schema = z.object({
//     username: z.string().describe('The username (without @) of the user to fetch posts for'),
//     max: z.number().describe('Maximum number of posts to return').max(100).default(20),
//   });

//   description =
//     'List posts made by a specific user on Product Hunt. Returns the products they have launched.';

//   protected params: ProductHuntToolParams;

//   constructor(params: ProductHuntToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new ProductHuntClient({
//         accessToken: this.params.accessToken,
//         baseUrl: this.params.baseUrl,
//       });

//       const data = await client.listUserPosts({
//         username: input.username,
//         max: input.max,
//       });

//       if (!data.user) {
//         return {
//           status: 'error',
//           error: 'User not found',
//           summary: `User with username "${input.username}" does not exist on Product Hunt`,
//         };
//       }

//       const posts = data.user.madePosts?.edges.map((edge) => edge.node) ?? [];

//       return {
//         status: 'success',
//         data: {
//           user: {
//             id: data.user.id,
//             name: data.user.name,
//             username: data.user.username,
//             profileImage: data.user.profileImage,
//           },
//           posts,
//           totalCount: posts.length,
//         },
//         summary: `Successfully retrieved ${posts.length} posts made by user "${input.username}"`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error listing user posts',
//         summary:
//           error instanceof Error
//             ? error.message
//             : 'Unknown error occurred while listing user posts',
//       };
//     }
//   }
// }

// export class ProductHuntListUpvotedPosts extends AgentBaseTool<ProductHuntToolParams> {
//   name = 'list_upvoted_posts';
//   toolsetKey = ProductHuntToolsetDefinition.key;

//   schema = z.object({
//     username: z
//       .string()
//       .describe('The username (without @) of the user to fetch upvoted posts for'),
//     max: z.number().describe('Maximum number of posts to return').max(100).default(20),
//   });

//   description =
//     'List posts upvoted by a specific user on Product Hunt. Returns the products they have voted for.';

//   protected params: ProductHuntToolParams;

//   constructor(params: ProductHuntToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new ProductHuntClient({
//         accessToken: this.params.accessToken,
//         baseUrl: this.params.baseUrl,
//       });

//       const data = await client.listUpvotedPosts({
//         username: input.username,
//         max: input.max,
//       });

//       if (!data.user) {
//         return {
//           status: 'error',
//           error: 'User not found',
//           summary: `User with username "${input.username}" does not exist on Product Hunt`,
//         };
//       }

//       const posts =
//         data.user.votedPosts?.edges.map((edge) => ({
//           ...edge.node,
//           userVoteTime: edge.node.votes?.find((vote) => vote.userId === data.user.id)?.createdAt,
//         })) ?? [];

//       return {
//         status: 'success',
//         data: {
//           user: {
//             id: data.user.id,
//             name: data.user.name,
//             username: data.user.username,
//             profileImage: data.user.profileImage,
//           },
//           posts,
//           totalCount: posts.length,
//         },
//         summary: `Successfully retrieved ${posts.length} posts upvoted by user "${input.username}"`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error listing upvoted posts',
//         summary:
//           error instanceof Error
//             ? error.message
//             : 'Unknown error occurred while listing upvoted posts',
//       };
//     }
//   }
// }

// export class ProductHuntListTopics extends AgentBaseTool<ProductHuntToolParams> {
//   name = 'list_topics';
//   toolsetKey = ProductHuntToolsetDefinition.key;

//   schema = z.object({});

//   description =
//     'List all available topics on Product Hunt. Returns topic names and slugs for filtering posts.';

//   protected params: ProductHuntToolParams;

//   constructor(params: ProductHuntToolParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const client = new ProductHuntClient({
//         accessToken: this.params.accessToken,
//         baseUrl: this.params.baseUrl,
//       });

//       const data = await client.listTopics();

//       const topics = data.topics.edges.map((edge) => edge.node);

//       return {
//         status: 'success',
//         data: {
//           topics,
//           totalCount: topics.length,
//         },
//         summary: `Successfully retrieved ${topics.length} topics from Product Hunt`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error listing topics',
//         summary:
//           error instanceof Error ? error.message : 'Unknown error occurred while listing topics',
//       };
//     }
//   }
// }

// export class ProductHuntToolset extends AgentBaseToolset<ProductHuntToolParams> {
//   toolsetKey = ProductHuntToolsetDefinition.key;
//   tools = [
//     ProductHuntListPosts,
//     ProductHuntListUserPosts,
//     ProductHuntListUpvotedPosts,
//     ProductHuntListTopics,
//   ] satisfies readonly AgentToolConstructor<ProductHuntToolParams>[];
// }
