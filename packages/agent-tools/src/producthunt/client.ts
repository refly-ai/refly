// // Product Hunt API Client
// // Based on Product Hunt GraphQL API

// export interface ProductHuntConfig {
//   accessToken: string;
//   baseUrl?: string;
// }

// export interface Topic {
//   name: string;
//   slug: string;
// }

// export interface Post {
//   id: string;
//   name: string;
//   tagline: string;
//   votesCount: number;
//   createdAt: string;
//   description?: string;
//   url?: string;
//   website?: string;
//   thumbnail?: {
//     url: string;
//   };
//   makers?: Array<{
//     id: string;
//     name: string;
//     username: string;
//     profileImage?: string;
//   }>;
// }

// export interface User {
//   id: string;
//   name: string;
//   username: string;
//   profileImage?: string;
//   madePosts?: {
//     edges: Array<{
//       node: Post;
//     }>;
//   };
//   votedPosts?: {
//     edges: Array<{
//       node: Post & {
//         votes: Array<{
//           id: string;
//           userId: string;
//           createdAt: string;
//         }>;
//       };
//     }>;
//   };
// }

// export interface ListTopicsResponse {
//   topics: {
//     edges: Array<{
//       node: Topic;
//     }>;
//   };
// }

// export interface ListPostsResponse {
//   posts: {
//     edges: Array<{
//       node: Post;
//     }>;
//   };
// }

// export interface ListUserPostsResponse {
//   user: User;
// }

// export interface ListUpvotedPostsResponse {
//   user: User;
// }

// export type SortBy = 'NEWEST' | 'POPULAR' | 'FEATURED';

// export interface ListPostsParams {
//   topic?: string;
//   sortBy?: SortBy;
//   max?: number;
// }

// export interface ListUserPostsParams {
//   username: string;
//   max?: number;
// }

// export interface ListUpvotedPostsParams {
//   username: string;
//   max?: number;
// }

// export class ProductHuntError extends Error {
//   constructor(
//     message: string,
//     public status?: number,
//     public response?: any,
//   ) {
//     super(message);
//     this.name = 'ProductHuntError';
//   }
// }

// export class ProductHuntClient {
//   private config: Required<ProductHuntConfig>;

//   constructor(config: ProductHuntConfig) {
//     this.config = {
//       baseUrl: config.baseUrl || 'https://api.producthunt.com/v2/api/graphql',
//       accessToken: config.accessToken,
//     };
//   }

//   private async request<T>(query: string, variables?: Record<string, any>): Promise<T> {
//     const response = await fetch(this.config.baseUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${this.config.accessToken}`,
//       },
//       body: JSON.stringify({
//         query,
//         variables,
//       }),
//     });

//     if (!response.ok) {
//       let errorData: any = {};
//       try {
//         errorData = await response.json();
//       } catch {
//         // Ignore JSON parsing errors
//       }

//       throw new ProductHuntError(
//         errorData.errors?.[0]?.message ?? `HTTP ${response.status}: ${response.statusText}`,
//         response.status,
//         errorData,
//       );
//     }

//     const data = await response.json();

//     if (data.errors?.length) {
//       throw new ProductHuntError(data.errors[0].message, response.status, data);
//     }

//     return data.data;
//   }

//   async listTopics(): Promise<ListTopicsResponse> {
//     const query = `
//       query {
//         topics {
//           edges {
//             node {
//               name
//               slug
//             }
//           }
//         }
//       }
//     `;

//     return this.request<ListTopicsResponse>(query);
//   }

//   async listPosts(params: ListPostsParams = {}): Promise<ListPostsResponse> {
//     const { topic, sortBy = 'NEWEST', max = 20 } = params;

//     const filterString = topic
//       ? `order: ${sortBy}, first: ${max}, topic: "${topic}"`
//       : `order: ${sortBy}, first: ${max}`;

//     const query = `
//       query {
//         posts(${filterString}) {
//           edges {
//             node {
//               id
//               name
//               tagline
//               votesCount
//               createdAt
//               description
//               url
//               website
//               thumbnail {
//                 url
//               }
//               makers {
//                 id
//                 name
//                 username
//                 profileImage
//               }
//             }
//           }
//         }
//       }
//     `;

//     return this.request<ListPostsResponse>(query);
//   }

//   async listUserPosts(params: ListUserPostsParams): Promise<ListUserPostsResponse> {
//     const { username, max = 20 } = params;

//     const query = `
//       query {
//         user(username: "${username}") {
//           id
//           name
//           username
//           profileImage
//           madePosts(first: ${max}) {
//             edges {
//               node {
//                 id
//                 name
//                 tagline
//                 votesCount
//                 createdAt
//                 description
//                 url
//                 website
//                 thumbnail {
//                   url
//                 }
//               }
//             }
//           }
//         }
//       }
//     `;

//     return this.request<ListUserPostsResponse>(query);
//   }

//   async listUpvotedPosts(params: ListUpvotedPostsParams): Promise<ListUpvotedPostsResponse> {
//     const { username, max = 20 } = params;

//     const query = `
//       query {
//         user(username: "${username}") {
//           id
//           name
//           username
//           profileImage
//           votedPosts(first: ${max}) {
//             edges {
//               node {
//                 id
//                 name
//                 tagline
//                 votesCount
//                 createdAt
//                 description
//                 url
//                 website
//                 thumbnail {
//                   url
//                 }
//                 votes {
//                   id
//                   userId
//                   createdAt
//                 }
//               }
//             }
//           }
//         }
//       }
//     `;

//     return this.request<ListUpvotedPostsResponse>(query);
//   }
// }

// // Export default instance creator
// export const createProductHuntClient = (config: ProductHuntConfig): ProductHuntClient => {
//   return new ProductHuntClient(config);
// };
