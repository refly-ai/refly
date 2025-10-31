import { ToolsetDefinition } from '@refly/openapi-schema';

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
