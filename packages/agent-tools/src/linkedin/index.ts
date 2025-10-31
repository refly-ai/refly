import { ToolsetDefinition } from '@refly/openapi-schema';

export const LinkedInToolsetDefinition: ToolsetDefinition = {
  key: 'linkedin',
  domain: 'https://linkedin.com',
  labelDict: {
    en: 'LinkedIn',
    'zh-CN': 'LinkedIn',
  },
  descriptionDict: {
    en: 'Interact with LinkedIn API to create posts, manage company pages, and more.',
    'zh-CN': '与 LinkedIn API 交互，创建帖子、管理公司页面等。',
  },
  tools: [
    {
      name: 'create_post',
      descriptionDict: {
        en: 'Create a new post on LinkedIn',
        'zh-CN': '在 LinkedIn 上创建新帖子',
      },
    },
    {
      name: 'delete_post',
      descriptionDict: {
        en: 'Delete a LinkedIn post',
        'zh-CN': '删除 LinkedIn 帖子',
      },
    },
    {
      name: 'get_my_info',
      descriptionDict: {
        en: 'Get authenticated user profile information',
        'zh-CN': '获取已认证用户的个人资料信息',
      },
    },
    {
      name: 'get_company_info',
      descriptionDict: {
        en: 'Get organizations where user has specific roles',
        'zh-CN': '获取用户具有特定角色的组织',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'linkedin',
      scope: ['w_member_social', 'r_liteprofile', 'r_organization_social'],
    },
  ],
  configItems: [],
};
