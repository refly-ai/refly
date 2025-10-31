import { ToolsetDefinition } from '@refly/openapi-schema';

export const RedditToolsetDefinition: ToolsetDefinition = {
  key: 'reddit',
  domain: 'https://reddit.com',
  labelDict: {
    en: 'Reddit',
    'zh-CN': 'Reddit',
  },
  descriptionDict: {
    en: 'Interact with Reddit API to create posts, manage comments, search content, and more.',
    'zh-CN': '与 Reddit API 交互，创建帖子、管理评论、搜索内容等。',
  },
  tools: [
    {
      name: 'create_post',
      descriptionDict: {
        en: 'Create a new post on Reddit',
        'zh-CN': '在 Reddit 上创建新帖子',
      },
    },
    {
      name: 'delete_post',
      descriptionDict: {
        en: 'Delete a Reddit post',
        'zh-CN': '删除 Reddit 帖子',
      },
    },
    {
      name: 'post_comment',
      descriptionDict: {
        en: 'Post a comment on Reddit',
        'zh-CN': '在 Reddit 上发表评论',
      },
    },
    {
      name: 'delete_comment',
      descriptionDict: {
        en: 'Delete a Reddit comment',
        'zh-CN': '删除 Reddit 评论',
      },
    },
    {
      name: 'edit_comment_or_post',
      descriptionDict: {
        en: 'Edit a Reddit comment or post',
        'zh-CN': '编辑 Reddit 评论或帖子',
      },
    },
    {
      name: 'retrieve_post',
      descriptionDict: {
        en: 'Retrieve posts from a subreddit',
        'zh-CN': '从子版块检索帖子',
      },
    },
    {
      name: 'retrieve_post_comments',
      descriptionDict: {
        en: 'Retrieve comments for a post',
        'zh-CN': '检索帖子的评论',
      },
    },
    {
      name: 'search_subreddits',
      descriptionDict: {
        en: 'Search across subreddits',
        'zh-CN': '跨子版块搜索',
      },
    },
    {
      name: 'get_user_flair',
      descriptionDict: {
        en: 'Get available flairs for a subreddit',
        'zh-CN': '获取子版块可用的标签',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'reddit',
      scope: ['submit', 'edit', 'read', 'identity'],
    },
  ],
  configItems: [],
};
