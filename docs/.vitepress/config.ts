import { defineConfig } from 'vitepress';

// Single navigation item
const enNav = [
  { text: 'Refly', link: 'https://refly.ai' },
  {
    text: 'Add to Chrome',
    link: 'https://chromewebstore.google.com/detail/lecbjbapfkinmikhadakbclblnemmjpd',
  },
  { text: 'Community', link: '/community/contact-us' },
  {
    text: 'v0.7.1',
    items: [{ text: 'Changelog', link: '/changelog/v0.7.1' }],
  },
  { text: 'Roadmap', link: '/roadmap' },
];

const zhNav = [
  { text: 'Refly', link: 'https://refly.ai' },
  {
    text: '添加到 Chrome',
    link: 'https://chromewebstore.google.com/detail/lecbjbapfkinmikhadakbclblnemmjpd',
  },
  { text: '社区', link: '/zh/community/contact-us' },
  {
    text: 'v0.7.1',
    items: [{ text: '更新日志', link: '/zh/changelog/v0.7.1' }],
  },
  { text: '路线图', link: '/zh/roadmap' },
];

// Sidebar translations
const sidebar = {
  en: [
    {
      text: 'Getting Started',
      items: [
        { text: 'Welcome to Refly', link: '/' }, // Points to index.md
        { text: 'Crash Course', link: '/guide/crash-course' },
        { text: 'Introduction', link: '/guide/introduction' },
        { text: 'Video Tutorials', link: '/guide/video-tutorials' },
        // Core Concepts needs to be created
        // { text: "Core Concepts", link: "/getting-started/core-concepts" },
      ],
    },
    {
      text: 'Cloud Version',
      items: [
        {
          text: 'Feature Intro',
          items: [
            { text: 'Product Overview', link: '/cloud/feature-intro/' },
            { text: 'Ask AI', link: '/cloud/feature-intro/ask-ai' },
            {
              text: 'Canvas and Nodes',
              link: '/cloud/feature-intro/canvas-nodes.md',
            },
            {
              text: 'Creation Toolbar',
              link: '/cloud/feature-intro/creation-toolbar',
            },
            {
              text: 'Global Search',
              link: '/cloud/feature-intro/global-search',
            },
            {
              text: 'Knowledge Base',
              link: '/cloud/feature-intro/knowledge-base',
            },
            { text: 'Templates', link: '/cloud/feature-intro/templates' },
            { text: 'UI Overview', link: '/cloud/feature-intro/ui-overview' },
          ],
        },
        { text: 'Chrome Extension', link: '/cloud/chrome-extension' },
      ],
    },
    {
      text: 'Community Version',
      items: [
        { text: 'Community Version Overview', link: '/community-version/' },
        {
          text: 'Self-Deploy',
          items: [
            {
              text: 'Deployment Guide',
              link: '/community-version/self-deploy/',
            },
            {
              text: 'Ollama Integration',
              link: '/community-version/self-deploy/ollama',
            },
            {
              text: 'Configuration Guide',
              link: '/community-version/self-deploy/configuration',
            },
            {
              text: 'Gitpod Quick Deploy',
              link: '/community-version/self-deploy/gitpod-quick-deploy',
            },
          ],
        },
        { text: 'FAQ', link: '/community-version/faq' },
      ],
    },
    {
      text: 'Scenarios',
      items: [
        { text: 'Scenarios', link: '/scenarios/' },
        {
          text: 'Create Tech PPT in 15 mins',
          link: '/scenarios/create-tech-ppt',
        },
      ],
    },
    {
      text: 'Future Plans',
      items: [{ text: 'Product Roadmap', link: '/roadmap' }],
    },
    {
      text: 'Community',
      items: [
        { text: 'Contact Us', link: '/community/contact-us' },
        { text: 'MCP Store Onboarding', link: '/community/mcp-onboarding' },
      ],
    },
    {
      text: 'About',
      items: [
        { text: 'Privacy Policy', link: '/about/privacy-policy' },
        { text: 'Terms of Service', link: '/about/terms-of-service' },
      ],
    },
    {
      text: 'Changelog',
      items: [
        { text: 'v0.7.1', link: '/changelog/v0.7.1' },
        { text: 'v0.7.0', link: '/changelog/v0.7.0' },
        { text: 'v0.6.0', link: '/changelog/v0.6.0' },
        { text: 'v0.5.0', link: '/changelog/v0.5.0' },
        { text: 'v0.4.2', link: '/changelog/v0.4.2' },
        { text: 'v0.4.1', link: '/changelog/v0.4.1' },
        { text: 'v0.4.0', link: '/changelog/v0.4.0' },
        { text: 'v0.3.0', link: '/changelog/v0.3.0' },
        { text: 'v0.2.4', link: '/changelog/v0.2.4' },
        { text: 'v0.2.3', link: '/changelog/v0.2.3' },
        { text: 'v0.2.2', link: '/changelog/v0.2.2' },
        { text: 'v0.2.1', link: '/changelog/v0.2.1' },
        { text: 'v0.2.0', link: '/changelog/v0.2.0' },
        { text: 'v0.1.2', link: '/changelog/v0.1.2' },
        { text: 'v0.1.1', link: '/changelog/v0.1.1' },
      ],
    },
  ],
  zh: [
    {
      text: '入门',
      items: [
        { text: '欢迎使用 Refly', link: '/zh/' }, // 指向 zh/index.md
        { text: '快速上手', link: '/zh/guide/crash-course' },
        { text: '入门介绍', link: '/zh/guide/introduction' },
        { text: '视频教程', link: '/zh/guide/video-tutorials' },
        // 核心概念需要新建文件后添加链接
        // { text: "核心概念", link: "/zh/getting-started/core-concepts" },
      ],
    },
    {
      text: '云版本',
      items: [
        {
          text: '功能介绍',
          items: [
            { text: '功能介绍概览', link: '/zh/cloud/feature-intro/' }, // 指向 zh/cloud/feature-intro/index.md
            { text: '问问 AI', link: '/zh/cloud/feature-intro/ask-ai' },
            {
              text: '画布和节点',
              link: '/zh/cloud/feature-intro/canvas-nodes.md',
            },
            {
              text: '创作工具栏',
              link: '/zh/cloud/feature-intro/creation-toolbar',
            },
            { text: '全局搜索', link: '/zh/cloud/feature-intro/global-search' },
            { text: '知识库', link: '/zh/cloud/feature-intro/knowledge-base' },
            { text: '模板', link: '/zh/cloud/feature-intro/templates' },
            {
              text: '右上角界面概览',
              link: '/zh/cloud/feature-intro/ui-overview',
            },
          ],
        },
        { text: 'Chrome 插件', link: '/zh/cloud/chrome-extension' },
      ],
    },
    {
      text: '社区版本',
      items: [
        { text: '社区版本概览', link: '/zh/community-version/' },
        {
          text: '私有部署',
          items: [
            { text: '部署指南', link: '/zh/community-version/self-deploy/' },
            {
              text: 'Ollama 集成',
              link: '/zh/community-version/self-deploy/ollama',
            },
            {
              text: '配置指南',
              link: '/zh/community-version/self-deploy/configuration',
            },
{ text: '个性化设置', link: '/zh/community-version/self-deploy/personalization.md' },
            { text: '本地快速使用 Refly', link: '/zh/community-version/self-deploy/local-quick-start.md' },
            {
              text: 'Gitpod 快速部署',
              link: '/zh/community-version/self-deploy/gitpod-quick-deploy',
            },
          ],
        },
        { text: '常见问题', link: '/zh/community-version/faq' },
      ],
    },
    {
      text: '场景分享',
      items: [
        { text: '场景分享', link: '/zh/scenarios/' },
        {
          text: '15分钟快速制作一份技术架构PPT',
          link: '/zh/scenarios/create-tech-ppt',
        },
      ],
    },
    {
      text: '未来计划',
      items: [{ text: '产品路线图', link: '/zh/roadmap' }],
    },
    {
      text: '社区',
      items: [
        { text: '联系我们', link: '/zh/community/contact-us' },
        { text: 'MCP Store 入驻指南', link: '/zh/community/mcp-onboarding' },
      ],
    },
    {
      text: '关于',
      items: [
        { text: '隐私政策', link: '/zh/about/privacy-policy' },
        { text: '服务条款', link: '/zh/about/terms-of-service' },
      ],
    },
    {
      text: '更新日志',
      items: [
        { text: 'v0.7.1', link: '/zh/changelog/v0.7.1' },
        { text: 'v0.7.0', link: '/zh/changelog/v0.7.0' },
        { text: 'v0.6.0', link: '/zh/changelog/v0.6.0' },
        { text: 'v0.5.0', link: '/zh/changelog/v0.5.0' },
        { text: 'v0.4.2', link: '/zh/changelog/v0.4.2' },
        { text: 'v0.4.1', link: '/zh/changelog/v0.4.1' },
        { text: 'v0.4.0', link: '/zh/changelog/v0.4.0' },
        { text: 'v0.3.0', link: '/zh/changelog/v0.3.0' },
        { text: 'v0.2.4', link: '/zh/changelog/v0.2.4' },
        { text: 'v0.2.3', link: '/zh/changelog/v0.2.3' },
        { text: 'v0.2.2', link: '/zh/changelog/v0.2.2' },
        { text: 'v0.2.1', link: '/zh/changelog/v0.2.1' },
        { text: 'v0.2.0', link: '/zh/changelog/v0.2.0' },
        { text: 'v0.1.2', link: '/zh/changelog/v0.1.2' },
        { text: 'v0.1.1', link: '/zh/changelog/v0.1.1' },
      ],
    },
  ],
};

export default defineConfig({
  // Site metadata
  title: 'Refly Docs',
  description: 'Refly Documentation',

  // Remove .html extensions from URLs
  cleanUrls: true,

  // Ignore dead links in README.md and other files
  ignoreDeadLinks: true,

  // Configure head
  head: [
    ['link', { rel: 'icon', href: '/logo/logo.svg' }],
    [
      'script',
      {
        async: '',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-RS0SJYDFJF',
      },
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-RS0SJYDFJF');`,
    ],
  ],

  // File path rewrites to map /en/* files to root URLs
  rewrites: {
    'en/index.md': 'index.md',
    'en/:path*': ':path*',
  },

  // i18n configuration
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      title: 'Refly Docs',
      description: 'Refly Documentation',
      themeConfig: {
        nav: enNav,
        sidebar: sidebar.en,
        siteTitle: 'Refly Docs',
        outline: [2, 4],
        outlineTitle: 'On this page',
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        returnToTopLabel: 'Return to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Theme',
        search: {
          provider: 'local',
          options: {
            translations: {
              button: {
                buttonText: 'Search',
                buttonAriaLabel: 'Search',
              },
              modal: {
                noResultsText: 'No results for',
                resetButtonTitle: 'Reset search',
                footer: {
                  selectText: 'to select',
                  navigateText: 'to navigate',
                  closeText: 'to close',
                },
              },
            },
          },
        },
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh',
      title: 'Refly 文档',
      description: 'Refly 开发文档',
      themeConfig: {
        nav: zhNav,
        sidebar: sidebar.zh,
        siteTitle: 'Refly 文档',
        outline: [2, 4],
        outlineTitle: '本页目录',
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
        search: {
          provider: 'local',
          options: {
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索',
              },
              modal: {
                noResultsText: '未找到相关结果',
                resetButtonTitle: '清除搜索',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
        },
      },
    },
  },

  themeConfig: {
    // Logo configuration
    logo: {
      light: '/logo/logo.svg',
      dark: '/logo/logo.svg',
    },

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/refly-ai/refly' }],

    // Language selection
    langMenuLabel: 'Change Language',

    // Enable search
    search: {
      provider: 'local',
    },
    outline: [2, 4], // 添加此行
  },
});
