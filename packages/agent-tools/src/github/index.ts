import { ToolsetDefinition } from '@refly/openapi-schema';

export const GitHubToolsetDefinition: ToolsetDefinition = {
  key: 'github',
  domain: 'https://github.com',
  labelDict: {
    en: 'GitHub',
    'zh-CN': 'GitHub',
  },
  descriptionDict: {
    en: 'Interact with GitHub API to manage repositories, issues, pull requests, and more.',
    'zh-CN': '与 GitHub API 交互，管理仓库、议题、拉取请求等。',
  },
  tools: [
    {
      name: 'accept_repository_invitation',
      descriptionDict: {
        en: 'Accept a repository invitation',
        'zh-CN': '接受仓库邀请',
      },
    },
    {
      name: 'star_repository',
      descriptionDict: {
        en: 'Star a repository for the authenticated user',
        'zh-CN': '为已认证用户标星仓库',
      },
    },
    {
      name: 'list_stargazers',
      descriptionDict: {
        en: 'List users who starred a repository',
        'zh-CN': '列出标星仓库的用户',
      },
    },
    {
      name: 'add_repository_collaborator',
      descriptionDict: {
        en: 'Add a user as a repository collaborator',
        'zh-CN': '将用户添加为仓库协作者',
      },
    },
    {
      name: 'add_assignees_to_issue',
      descriptionDict: {
        en: 'Add assignees to an issue',
        'zh-CN': '为议题添加负责人',
      },
    },
    {
      name: 'add_labels_to_issue',
      descriptionDict: {
        en: 'Add labels to an issue',
        'zh-CN': '为议题添加标签',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'github',
      scope: ['repo', 'user', 'admin:org'],
    },
  ],
  configItems: [],
};
