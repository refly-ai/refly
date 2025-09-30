import { z } from 'zod';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { ToolParams } from '@langchain/core/tools';
import OAuth from 'oauth-1.0a';
import { createHmac } from 'node:crypto';

export const TwitterToolsetDefinition: ToolsetDefinition = {
  key: 'twitter',
  domain: 'https://twitter.com',
  labelDict: {
    en: 'Twitter',
    'zh-CN': '推特',
  },
  descriptionDict: {
    en: 'Interact with Twitter API to post tweets, search content, manage followers, and more.',
    'zh-CN': '与Twitter API交互，发布推文、搜索内容、管理关注者等。',
  },
  tools: [
    {
      name: 'create_tweet',
      descriptionDict: {
        en: 'Create a new tweet with text and optional media.',
        'zh-CN': '创建包含文本和可选媒体的新推文。',
      },
    },
    {
      name: 'get_tweet',
      descriptionDict: {
        en: 'Get detailed information about a specific tweet.',
        'zh-CN': '获取特定推文的详细信息。',
      },
    },
    {
      name: 'delete_tweet',
      descriptionDict: {
        en: 'Delete a tweet by its ID.',
        'zh-CN': '通过ID删除推文。',
      },
    },
    {
      name: 'search_tweets',
      descriptionDict: {
        en: 'Search for tweets using query parameters.',
        'zh-CN': '使用查询参数搜索推文。',
      },
    },
    {
      name: 'get_user',
      descriptionDict: {
        en: 'Get detailed information about a Twitter user.',
        'zh-CN': '获取Twitter用户的详细信息。',
      },
    },
    {
      name: 'list_user_tweets',
      descriptionDict: {
        en: 'Get a list of tweets from a specific user.',
        'zh-CN': '获取特定用户发布的推文列表。',
      },
    },
    {
      name: 'list_followers',
      descriptionDict: {
        en: 'Get a list of users who follow a specific user.',
        'zh-CN': '获取关注特定用户的用户列表。',
      },
    },
    {
      name: 'list_following',
      descriptionDict: {
        en: 'Get a list of users that a specific user is following.',
        'zh-CN': '获取特定用户正在关注的用户列表。',
      },
    },
    {
      name: 'follow_user',
      descriptionDict: {
        en: 'Follow a Twitter user.',
        'zh-CN': '关注Twitter用户。',
      },
    },
    {
      name: 'unfollow_user',
      descriptionDict: {
        en: 'Unfollow a Twitter user.',
        'zh-CN': '取消关注Twitter用户。',
      },
    },
    {
      name: 'like_tweet',
      descriptionDict: {
        en: 'Like a tweet.',
        'zh-CN': '点赞推文。',
      },
    },
    {
      name: 'unlike_tweet',
      descriptionDict: {
        en: 'Unlike a tweet.',
        'zh-CN': '取消点赞推文。',
      },
    },
    {
      name: 'retweet',
      descriptionDict: {
        en: 'Retweet a tweet.',
        'zh-CN': '转发推文。',
      },
    },
    {
      name: 'send_dm',
      descriptionDict: {
        en: 'Send a direct message to a user.',
        'zh-CN': '向用户发送私信。',
      },
    },
    {
      name: 'upload_media',
      descriptionDict: {
        en: 'Upload media files for use in tweets.',
        'zh-CN': '上传媒体文件以在推文中使用。',
      },
    },
    {
      name: 'add_user_to_list',
      descriptionDict: {
        en: 'Add a user to a Twitter list.',
        'zh-CN': '将用户添加到Twitter列表中。',
      },
    },
    {
      name: 'list_mentions',
      descriptionDict: {
        en: 'Get tweets that mention a specific user.',
        'zh-CN': '获取提及特定用户的推文。',
      },
    },
    {
      name: 'list_favorites',
      descriptionDict: {
        en: 'Get tweets liked by a specific user.',
        'zh-CN': '获取特定用户点赞的推文。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'twitter',
      scope: ['tweet.read', 'tweet.write', 'users.read'],
    },
  ],
  configItems: [],
};

// OAuth1a data will be automatically injected
export interface TwitterParams extends ToolParams {
  // OAuth1a 必需参数
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  refreshToken: string; // This is actually the oauth_token_secret
}

// Helper function to create authenticated Twitter API client
function createTwitterClient(params: TwitterParams) {
  // Twitter API v2 client with OAuth1a authentication
  const consumer = {
    key: params.consumerKey,
    secret: params.consumerSecret,
  };

  const oauth = new OAuth({
    consumer,
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return createHmac('sha1', key).update(base_string).digest('base64');
    },
  });

  const token = {
    key: params.accessToken,
    secret: params.refreshToken, // This is actually oauth_token_secret
  };

  return {
    baseURL: 'https://api.twitter.com/2',
    consumer,
    oauth,
    token,
  };
}

// Helper function to get authenticated user ID
async function getAuthenticatedUserId(params: TwitterParams): Promise<string> {
  const response = await makeTwitterRequest('GET', '/users/me', params, undefined, {
    'user.fields': 'id',
  });
  return response.data.id;
}

// Helper function to make Twitter API requests with OAuth1a
async function makeTwitterRequest(
  method: string,
  url: string,
  params: TwitterParams,
  data?: any,
  queryParams?: Record<string, string>,
): Promise<any> {
  const client = createTwitterClient(params);

  // Build full URL with query parameters
  let fullUrl = `${client.baseURL}${url}`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const urlObj = new URL(fullUrl);
    for (const [key, value] of Object.entries(queryParams)) {
      urlObj.searchParams.set(key, value);
    }
    fullUrl = urlObj.toString();
  }

  // Prepare request data for OAuth signing
  const requestData = {
    url: fullUrl,
    method: method.toUpperCase(),
  };

  // Generate OAuth1a signature
  const authHeader = client.oauth.toHeader(client.oauth.authorize(requestData, client.token));

  // Prepare headers
  const headers: Record<string, string> = {
    Authorization: authHeader.Authorization,
    'Content-Type': 'application/json',
  };

  // Prepare request options
  const requestOptions: any = {
    method: requestData.method,
    headers,
  };

  // Add body for POST/PUT requests
  if (data && (method === 'POST' || method === 'PUT')) {
    requestOptions.body = JSON.stringify(data);
  }

  const response = await fetch(fullUrl, requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Twitter API error: ${response.status} ${response.statusText} - ${errorData?.title || 'Unknown error'}`,
    );
  }

  return response.json();
}

export class TwitterCreateTweet extends AgentBaseTool<TwitterParams> {
  name = 'create_tweet';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    text: z.string().describe('The text content of the tweet'),
    replyToTweetId: z.string().optional().describe('ID of the tweet to reply to'),
    mediaIds: z.array(z.string()).optional().describe('Array of media IDs to attach to the tweet'),
    placeId: z.string().optional().describe('Place ID for geo location'),
  });

  description = 'Create a new tweet with text and optional media or location.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const tweetData: any = {
        text: input.text,
      };

      if (input.replyToTweetId) {
        tweetData.reply = {
          in_reply_to_tweet_id: input.replyToTweetId,
        };
      }

      if (input.mediaIds?.length) {
        tweetData.media = {
          media_ids: input.mediaIds,
        };
      }

      if (input.placeId) {
        tweetData.geo = {
          place_id: input.placeId,
        };
      }

      const response = await makeTwitterRequest('POST', '/tweets', this.params, tweetData);

      const result = {
        message: 'Tweet created successfully',
        tweet: {
          id: response.data?.id,
          text: response.data?.text,
          created_at: response.data?.created_at,
          author_id: response.data?.author_id,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created tweet: "${input.text.substring(0, 50)}${input.text.length > 50 ? '...' : ''}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating tweet',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating tweet',
      };
    }
  }
}

export class TwitterGetTweet extends AgentBaseTool<TwitterParams> {
  name = 'get_tweet';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    tweetId: z.string().describe('The ID of the tweet to retrieve'),
    includeFields: z
      .array(z.string())
      .optional()
      .describe('Additional fields to include in the response'),
  });

  description = 'Get detailed information about a specific tweet by its ID.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const queryParams: Record<string, string> = {};
      if (input.includeFields?.length) {
        queryParams['tweet.fields'] = input.includeFields.join(',');
      } else {
        queryParams['tweet.fields'] = 'created_at,public_metrics,author_id,context_annotations';
      }

      const response = await makeTwitterRequest(
        'GET',
        `/tweets/${input.tweetId}`,
        this.params,
        undefined,
        queryParams,
      );

      const tweet = response.data;
      const result = {
        message: 'Tweet retrieved successfully',
        tweet: {
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          author_id: tweet.author_id,
          public_metrics: tweet.public_metrics,
          context_annotations: tweet.context_annotations,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved tweet with ID: ${input.tweetId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting tweet',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting tweet',
      };
    }
  }
}

export class TwitterDeleteTweet extends AgentBaseTool<TwitterParams> {
  name = 'delete_tweet';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    tweetId: z.string().describe('The ID of the tweet to delete'),
  });

  description = 'Delete a tweet by its ID.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const response = await makeTwitterRequest('DELETE', `/tweets/${input.tweetId}`, this.params);

      const result = {
        message: 'Tweet deleted successfully',
        deleted: response.data?.deleted,
        tweetId: input.tweetId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted tweet with ID: ${input.tweetId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting tweet',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while deleting tweet',
      };
    }
  }
}

export class TwitterSearchTweets extends AgentBaseTool<TwitterParams> {
  name = 'search_tweets';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('Search query (e.g., "cats", "#hashtag", "from:username")'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of tweets to return (default: 10, max: 100)'),
    sortOrder: z
      .enum(['recency', 'relevancy'])
      .optional()
      .describe('Sort order for results (default: recency)'),
  });

  description = 'Search for tweets using Twitter search query syntax.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const maxResults = Math.min(input.maxResults ?? 10, 100);
      const sortOrder = input.sortOrder ?? 'recency';

      const queryParams: Record<string, string> = {
        query: input.query,
        'tweet.fields': 'created_at,public_metrics,author_id,text',
        'user.fields': 'username,name,verified',
        expansions: 'author_id',
        max_results: maxResults.toString(),
        sort_order: sortOrder,
      };

      const response = await makeTwitterRequest(
        'GET',
        '/tweets/search/recent',
        this.params,
        undefined,
        queryParams,
      );

      const tweets = response.data ?? [];
      const users = response.includes?.users ?? [];

      const result = {
        message: `Found ${tweets.length} tweets matching query`,
        query: input.query,
        count: tweets.length,
        tweets: tweets.map((tweet: any) => ({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          author_id: tweet.author_id,
          public_metrics: tweet.public_metrics,
          author: users.find((user: any) => user.id === tweet.author_id),
        })),
      };

      return {
        status: 'success',
        data: result,
        summary: `Search completed successfully. Found ${tweets.length} tweets matching "${input.query}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching tweets',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while searching tweets',
      };
    }
  }
}

export class TwitterGetUser extends AgentBaseTool<TwitterParams> {
  name = 'get_user';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to get information for'),
    username: z.string().optional().describe('Username to get information for (without @)'),
  });

  description = 'Get detailed information about a Twitter user by ID or username.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      const endpoint = input.username
        ? `/users/by/username/${input.username}`
        : `/users/${input.userId}`;

      const queryParams: Record<string, string> = {
        'user.fields': 'created_at,description,public_metrics,verified,location,profile_image_url',
      };

      const response = await makeTwitterRequest(
        'GET',
        endpoint,
        this.params,
        undefined,
        queryParams,
      );

      const user = response.data;
      const result = {
        message: 'User information retrieved successfully',
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          description: user.description,
          created_at: user.created_at,
          verified: user.verified,
          public_metrics: user.public_metrics,
          location: user.location,
          profile_image_url: user.profile_image_url,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved user information for @${user.username}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting user',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting user',
      };
    }
  }
}

export class TwitterListUserTweets extends AgentBaseTool<TwitterParams> {
  name = 'list_user_tweets';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to get tweets for'),
    username: z.string().optional().describe('Username to get tweets for (without @)'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of tweets to return (default: 10, max: 100)'),
    sinceId: z.string().optional().describe('Return tweets newer than this ID'),
  });

  description = 'Get a list of tweets from a specific user.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      const maxResults = Math.min(input.maxResults ?? 10, 100);

      const queryParams: Record<string, string> = {
        'tweet.fields': 'created_at,public_metrics,text',
        max_results: maxResults.toString(),
      };

      if (input.sinceId) {
        queryParams.since_id = input.sinceId;
      }

      let endpoint: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        endpoint = `/users/${userResponse.data.id}/tweets`;
      } else {
        endpoint = `/users/${input.userId}/tweets`;
      }

      const response = await makeTwitterRequest(
        'GET',
        endpoint,
        this.params,
        undefined,
        queryParams,
      );

      const tweets = response.data ?? [];
      const result = {
        message: `Found ${tweets.length} tweets`,
        count: tweets.length,
        tweets: tweets.map((tweet: any) => ({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          public_metrics: tweet.public_metrics,
        })),
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${tweets.length} tweets from user`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing user tweets',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while listing user tweets',
      };
    }
  }
}

export class TwitterListFollowers extends AgentBaseTool<TwitterParams> {
  name = 'list_followers';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to get followers for'),
    username: z.string().optional().describe('Username to get followers for (without @)'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of followers to return (default: 10, max: 100)'),
  });

  description = 'Get a list of users who follow a specific user.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      const maxResults = Math.min(input.maxResults ?? 10, 100);

      const queryParams = new URLSearchParams({
        'user.fields': 'username,name,verified,description,public_metrics',
        max_results: maxResults.toString(),
      });

      let endpoint: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        endpoint = `/users/${userResponse.data.id}/followers`;
      } else {
        endpoint = `/users/${input.userId}/followers`;
      }

      const response = await makeTwitterRequest('GET', `${endpoint}?${queryParams}`, this.params);

      const followers = response.data ?? [];
      const result = {
        message: `Found ${followers.length} followers`,
        count: followers.length,
        followers: followers.map((follower: any) => ({
          id: follower.id,
          username: follower.username,
          name: follower.name,
          verified: follower.verified,
          description: follower.description,
          public_metrics: follower.public_metrics,
        })),
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${followers.length} followers`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing followers',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing followers',
      };
    }
  }
}

export class TwitterListFollowing extends AgentBaseTool<TwitterParams> {
  name = 'list_following';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to get following for'),
    username: z.string().optional().describe('Username to get following for (without @)'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of following to return (default: 10, max: 100)'),
  });

  description = 'Get a list of users that a specific user is following.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      const maxResults = Math.min(input.maxResults ?? 10, 100);

      const queryParams = new URLSearchParams({
        'user.fields': 'username,name,verified,description,public_metrics',
        max_results: maxResults.toString(),
      });

      let endpoint: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        endpoint = `/users/${userResponse.data.id}/following`;
      } else {
        endpoint = `/users/${input.userId}/following`;
      }

      const response = await makeTwitterRequest('GET', `${endpoint}?${queryParams}`, this.params);

      const following = response.data ?? [];
      const result = {
        message: `Found ${following.length} following`,
        count: following.length,
        following: following.map((user: any) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          verified: user.verified,
          description: user.description,
          public_metrics: user.public_metrics,
        })),
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${following.length} following users`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing following',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing following',
      };
    }
  }
}

export class TwitterFollowUser extends AgentBaseTool<TwitterParams> {
  name = 'follow_user';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to follow'),
    username: z.string().optional().describe('Username to follow (without @)'),
  });

  description = 'Follow a Twitter user.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      let targetUserId: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        targetUserId = userResponse.data.id;
      } else {
        targetUserId = input.userId!;
      }

      const response = await makeTwitterRequest(
        'POST',
        `/users/${targetUserId}/following`,
        this.params,
        {},
      );

      const result = {
        message: 'User followed successfully',
        followed_user: {
          id: targetUserId,
          following: response.data?.following,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully followed user with ID: ${targetUserId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error following user',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while following user',
      };
    }
  }
}

export class TwitterUnfollowUser extends AgentBaseTool<TwitterParams> {
  name = 'unfollow_user';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to unfollow'),
    username: z.string().optional().describe('Username to unfollow (without @)'),
  });

  description = 'Unfollow a Twitter user.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      let targetUserId: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        targetUserId = userResponse.data.id;
      } else {
        targetUserId = input.userId!;
      }

      const response = await makeTwitterRequest(
        'DELETE',
        `/users/${targetUserId}/following`,
        this.params,
      );

      const result = {
        message: 'User unfollowed successfully',
        unfollowed_user: {
          id: targetUserId,
          following: response.data?.following,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully unfollowed user with ID: ${targetUserId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error unfollowing user',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while unfollowing user',
      };
    }
  }
}

export class TwitterLikeTweet extends AgentBaseTool<TwitterParams> {
  name = 'like_tweet';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    tweetId: z.string().describe('The ID of the tweet to like'),
  });

  description = 'Like a tweet.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const userId = await getAuthenticatedUserId(this.params);
      const response = await makeTwitterRequest('POST', `/users/${userId}/likes`, this.params, {
        tweet_id: input.tweetId,
      });

      const result = {
        message: 'Tweet liked successfully',
        liked_tweet: {
          id: input.tweetId,
          liked: response.data?.liked,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully liked tweet with ID: ${input.tweetId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error liking tweet',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while liking tweet',
      };
    }
  }
}

export class TwitterUnlikeTweet extends AgentBaseTool<TwitterParams> {
  name = 'unlike_tweet';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    tweetId: z.string().describe('The ID of the tweet to unlike'),
  });

  description = 'Unlike a tweet.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const userId = await getAuthenticatedUserId(this.params);
      const response = await makeTwitterRequest(
        'DELETE',
        `/users/${userId}/likes/${input.tweetId}`,
        this.params,
      );

      const result = {
        message: 'Tweet unliked successfully',
        unliked_tweet: {
          id: input.tweetId,
          liked: response.data?.liked,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully unliked tweet with ID: ${input.tweetId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error unliking tweet',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while unliking tweet',
      };
    }
  }
}

export class TwitterRetweet extends AgentBaseTool<TwitterParams> {
  name = 'retweet';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    tweetId: z.string().describe('The ID of the tweet to retweet'),
  });

  description = 'Retweet a tweet.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const userId = await getAuthenticatedUserId(this.params);
      const response = await makeTwitterRequest('POST', `/users/${userId}/retweets`, this.params, {
        tweet_id: input.tweetId,
      });

      const result = {
        message: 'Tweet retweeted successfully',
        retweeted_tweet: {
          id: input.tweetId,
          retweeted: response.data?.retweeted,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retweeted tweet with ID: ${input.tweetId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retweeting tweet',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while retweeting tweet',
      };
    }
  }
}

export class TwitterSendDM extends AgentBaseTool<TwitterParams> {
  name = 'send_dm';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to send DM to'),
    username: z.string().optional().describe('Username to send DM to (without @)'),
    text: z.string().describe('Text content of the direct message'),
  });

  description = 'Send a direct message to a user.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      let recipientId: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        recipientId = userResponse.data.id;
      } else {
        recipientId = input.userId!;
      }

      const response = await makeTwitterRequest(
        'POST',
        `/dm_conversations/with/${recipientId}/messages`,
        this.params,
        {
          text: input.text,
        },
      );

      const result = {
        message: 'Direct message sent successfully',
        dm: {
          id: response.data?.dm_conversation_id,
          text: input.text,
          recipient_id: recipientId,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully sent DM to user with ID: ${recipientId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error sending direct message',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while sending direct message',
      };
    }
  }
}

export class TwitterUploadMedia extends AgentBaseTool<TwitterParams> {
  name = 'upload_media';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    mediaData: z.string().describe('Base64 encoded media data'),
    mediaType: z
      .enum(['image/jpeg', 'image/png', 'image/gif', 'video/mp4'])
      .describe('MIME type of the media'),
    mediaCategory: z
      .enum(['tweet_image', 'tweet_video', 'tweet_gif'])
      .optional()
      .describe('Category of the media for tweets'),
  });

  description = 'Upload media files for use in tweets.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // Decode base64 data
      const mediaBuffer = Buffer.from(input.mediaData, 'base64');

      // Create form data for upload
      const formData = new FormData();
      formData.append('media_data', mediaBuffer.toString('base64'));
      formData.append('media_category', input.mediaCategory ?? 'tweet_image');

      const response = await makeTwitterRequest(
        'POST',
        '/media/upload.json',
        this.params,
        formData,
      );

      const result = {
        message: 'Media uploaded successfully',
        media: {
          media_id: response.media_id,
          media_id_string: response.media_id_string,
          size: response.size,
          expires_after_secs: response.expires_after_secs,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully uploaded media with ID: ${response.media_id_string}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error uploading media',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while uploading media',
      };
    }
  }
}

export class TwitterAddUserToList extends AgentBaseTool<TwitterParams> {
  name = 'add_user_to_list';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    listId: z.string().describe('The ID of the list to add the user to'),
    userId: z.string().optional().describe('User ID to add to the list'),
    username: z.string().optional().describe('Username to add to the list (without @)'),
  });

  description = 'Add a user to a Twitter list.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      let targetUserId: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        targetUserId = userResponse.data.id;
      } else {
        targetUserId = input.userId!;
      }

      const response = await makeTwitterRequest(
        'POST',
        `/lists/${input.listId}/members`,
        this.params,
        {
          user_id: targetUserId,
        },
      );

      const result = {
        message: 'User added to list successfully',
        list_member: {
          list_id: input.listId,
          user_id: targetUserId,
          is_member: response.data?.is_member,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully added user ${targetUserId} to list ${input.listId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error adding user to list',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while adding user to list',
      };
    }
  }
}

export class TwitterListMentions extends AgentBaseTool<TwitterParams> {
  name = 'list_mentions';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to get mentions for'),
    username: z.string().optional().describe('Username to get mentions for (without @)'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of mentions to return (default: 10, max: 100)'),
  });

  description = 'Get tweets that mention a specific user.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      const maxResults = Math.min(input.maxResults ?? 10, 100);

      const queryParams = new URLSearchParams({
        'tweet.fields': 'created_at,public_metrics,text,author_id',
        'user.fields': 'username,name,verified',
        expansions: 'author_id',
        max_results: maxResults.toString(),
      });

      let endpoint: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        endpoint = `/users/${userResponse.data.id}/mentions`;
      } else {
        endpoint = `/users/${input.userId}/mentions`;
      }

      const response = await makeTwitterRequest('GET', `${endpoint}?${queryParams}`, this.params);

      const mentions = response.data ?? [];
      const users = response.includes?.users ?? [];

      const result = {
        message: `Found ${mentions.length} mentions`,
        count: mentions.length,
        mentions: mentions.map((tweet: any) => ({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          author_id: tweet.author_id,
          public_metrics: tweet.public_metrics,
          author: users.find((user: any) => user.id === tweet.author_id),
        })),
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${mentions.length} mentions`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing mentions',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing mentions',
      };
    }
  }
}

export class TwitterListFavorites extends AgentBaseTool<TwitterParams> {
  name = 'list_favorites';
  toolsetKey = TwitterToolsetDefinition.key;

  schema = z.object({
    userId: z.string().optional().describe('User ID to get favorites for'),
    username: z.string().optional().describe('Username to get favorites for (without @)'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of favorites to return (default: 10, max: 100)'),
  });

  description = 'Get tweets liked by a specific user.';

  protected params: TwitterParams;

  constructor(params: TwitterParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      if (!input.userId && !input.username) {
        throw new Error('Either userId or username must be provided');
      }

      const maxResults = Math.min(input.maxResults ?? 10, 100);

      const queryParams = new URLSearchParams({
        'tweet.fields': 'created_at,public_metrics,text,author_id',
        'user.fields': 'username,name,verified',
        expansions: 'author_id',
        max_results: maxResults.toString(),
      });

      let endpoint: string;
      if (input.username) {
        // First get user ID from username
        const userResponse = await makeTwitterRequest(
          'GET',
          `/users/by/username/${input.username}`,
          this.params,
        );
        endpoint = `/users/${userResponse.data.id}/liked_tweets`;
      } else {
        endpoint = `/users/${input.userId}/liked_tweets`;
      }

      const response = await makeTwitterRequest('GET', `${endpoint}?${queryParams}`, this.params);

      const favorites = response.data ?? [];
      const users = response.includes?.users ?? [];

      const result = {
        message: `Found ${favorites.length} favorites`,
        count: favorites.length,
        favorites: favorites.map((tweet: any) => ({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          author_id: tweet.author_id,
          public_metrics: tweet.public_metrics,
          author: users.find((user: any) => user.id === tweet.author_id),
        })),
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${favorites.length} favorites`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing favorites',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing favorites',
      };
    }
  }
}

export class TwitterToolset extends AgentBaseToolset<TwitterParams> {
  toolsetKey = TwitterToolsetDefinition.key;
  tools = [
    TwitterCreateTweet,
    TwitterGetTweet,
    TwitterDeleteTweet,
    TwitterSearchTweets,
    TwitterGetUser,
    TwitterListUserTweets,
    TwitterListFollowers,
    TwitterListFollowing,
    TwitterFollowUser,
    TwitterUnfollowUser,
    TwitterLikeTweet,
    TwitterUnlikeTweet,
    TwitterRetweet,
    TwitterSendDM,
    TwitterUploadMedia,
    TwitterAddUserToList,
    TwitterListMentions,
    TwitterListFavorites,
  ] satisfies readonly AgentToolConstructor<TwitterParams>[];
}
